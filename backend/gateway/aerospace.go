package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Fixed upstreams prevent arbitrary proxying. Each feed has a shared cache and
// failure backoff, so additional dashboard viewers do not multiply API requests.
type aerospaceFeed struct {
	mu        sync.Mutex
	url       string
	ttl       time.Duration
	client    *http.Client
	body      json.RawMessage
	fetched   time.Time
	attempted time.Time
	failed    bool
	retryAt   time.Time
	lastError string
}

func (f *aerospaceFeed) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if time.Since(f.attempted) >= f.ttl && !time.Now().Before(f.retryAt) {
		f.attempted = time.Now()
		f.failed = true
		f.lastError = "Provider request failed"
		upstream := f.url
		if strings.Contains(upstream, "thespacedevs.com") {
			upstream += "&net__gte=" + time.Now().UTC().Add(-24*time.Hour).Format("2006-01-02T15:04:05Z")
		}
		request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstream, nil)
		var resp *http.Response
		if err == nil {
			request.Header.Set("User-Agent", "Aurora-Space/0.1")
			request.Header.Set("Digitraffic-User", "Aurora-Space/local")
			resp, err = f.client.Do(request)
		}
		if err == nil {
			body, readErr := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK && readErr == nil && json.Valid(body) {
				f.body, f.fetched, f.failed = body, time.Now().UTC(), false
				f.retryAt, f.lastError = time.Time{}, ""
			} else {
				f.lastError = fmt.Sprintf("Provider returned HTTP %d", resp.StatusCode)
				if resp.StatusCode == http.StatusTooManyRequests {
					f.lastError = "Provider rate limit reached (HTTP 429)"
				}
				if readErr != nil || !json.Valid(body) {
					f.lastError += "; response unavailable or invalid"
				}
				f.retryAt = providerRetryAt(resp.Header.Get("Retry-After"), time.Now())
				if delay := resp.Header.Get("X-Rate-Limit-Retry-After-Seconds"); delay != "" {
					f.retryAt = maxTime(f.retryAt, providerRetryAt(delay, time.Now()))
				}
			}
		}
	}
	if f.body == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]any{"error": f.lastError, "nextRetryAt": maxTime(f.retryAt, f.attempted.Add(f.ttl))})
		return
	}
	json.NewEncoder(w).Encode(struct {
		Data        json.RawMessage `json:"data"`
		FetchedAt   time.Time       `json:"fetchedAt"`
		Stale       bool            `json:"stale"`
		Error       string          `json:"error,omitempty"`
		NextRetryAt time.Time       `json:"nextRetryAt"`
	}{f.body, f.fetched, f.failed || time.Since(f.fetched) > f.ttl*2, f.lastError, maxTime(f.retryAt, f.attempted.Add(f.ttl))})
}
func providerRetryAt(value string, now time.Time) time.Time {
	if seconds, err := strconv.Atoi(value); err == nil && seconds > 0 && seconds < 30*86400 {
		return now.Add(time.Duration(seconds) * time.Second)
	}
	if date, err := http.ParseTime(value); err == nil && date.After(now) {
		return date
	}
	return time.Time{}
}
func registerAerospace(mux *http.ServeMux) {
	client := &http.Client{Timeout: 10 * time.Second}
	// One worldwide snapshot shared by all clients; obey OpenSky's daily quota.
	mux.Handle("/api/aerospace/aircraft/worldwide", &aerospaceFeed{url: "https://opensky-network.org/api/states/all", ttl: time.Minute, client: client})
	feeds := map[string]string{
		"florida":    "point/28.6/-80.6/250",
		"chicago":    "point/41.9/-87.6/250",
		"california": "point/34.7/-120.6/250",
		"europe":     "point/50/8/250",
		"asia":       "point/35/139/250",
		"military":   "mil",
		"australia":  "point/-33.9/151.2/250",
		"india":      "point/28.6/77.2/250",
		"brazil":     "point/-23.5/-46.6/250",
		"africa":     "point/-26.2/28/250",
		"gulf":       "point/25.2/55.3/250",
	}
	for name, path := range feeds {
		mux.Handle("/api/aerospace/aircraft/"+name, &aerospaceFeed{url: "https://api.adsb.lol/v2/" + path, ttl: 10 * time.Second, client: client})
	}
	var regionMu sync.Mutex
	regions := map[string]*aerospaceFeed{}
	mux.HandleFunc("/api/aerospace/aircraft/point/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/aerospace/aircraft/point/"), "/")
		if len(parts) != 2 {
			http.Error(w, "Invalid coordinates", 400)
			return
		}
		lat, e1 := strconv.Atoi(parts[0])
		lon, e2 := strconv.Atoi(parts[1])
		if e1 != nil || e2 != nil || lat < -90 || lat > 90 || lon < -180 || lon > 180 {
			http.Error(w, "Invalid coordinates", 400)
			return
		}
		key := fmt.Sprintf("%d/%d", lat, lon)
		regionMu.Lock()
		feed := regions[key]
		if feed == nil {
			if len(regions) >= 64 {
				for oldKey := range regions {
					delete(regions, oldKey)
					break
				}
			}
			feed = &aerospaceFeed{url: "https://api.adsb.lol/v2/point/" + key + "/250", ttl: 10 * time.Second, client: client}
			regions[key] = feed
		}
		regionMu.Unlock()
		feed.ServeHTTP(w, r)
	})
	var routesMu sync.Mutex
	routes := map[string]*aerospaceFeed{}
	callsignPattern := regexp.MustCompile(`^[A-Z0-9]{2,12}$`)
	mux.HandleFunc("/api/aerospace/route/", func(w http.ResponseWriter, r *http.Request) {
		callsign := strings.ToUpper(strings.TrimPrefix(r.URL.Path, "/api/aerospace/route/"))
		if !callsignPattern.MatchString(callsign) {
			http.Error(w, "Invalid callsign", 400)
			return
		}
		routesMu.Lock()
		feed := routes[callsign]
		if feed == nil {
			if len(routes) >= 256 {
				for key := range routes {
					delete(routes, key)
					break
				}
			}
			feed = &aerospaceFeed{url: "https://api.adsbdb.com/v0/callsign/" + callsign, ttl: 6 * time.Hour, client: client}
			routes[callsign] = feed
		}
		routesMu.Unlock()
		feed.ServeHTTP(w, r)
	})

	mux.Handle("/api/aerospace/launches", &aerospaceFeed{url: "https://ll.thespacedevs.com/2.3.0/launches/?limit=30&mode=detailed&ordering=net", ttl: 5 * time.Minute, client: client})
}
