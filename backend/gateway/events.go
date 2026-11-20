package main

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Only documented OpenF1 resources and bounded filters can reach this proxy.
// Credentials stay on the gateway; the browser never receives the token.
type f1Transport struct {
	token string
	base  http.RoundTripper
}

func (t f1Transport) RoundTrip(r *http.Request) (*http.Response, error) {
	c := r.Clone(r.Context())
	c.Header = r.Header.Clone()
	if t.token != "" && r.URL.Hostname() == "api.openf1.org" {
		c.Header.Set("Authorization", "Bearer "+t.token)
	}
	return t.base.RoundTrip(c)
}

var f1Number = regexp.MustCompile(`^[0-9]{1,8}$`)

func f1Query(resource string, q url.Values) (url.Values, error) {
	allowed := map[string]bool{"sessions": true, "drivers": true, "location": true, "car_data": true, "position": true, "intervals": true, "laps": true, "session_result": true, "race_control": true, "stints": true, "weather": true}
	if !allowed[resource] {
		return nil, fmt.Errorf("unknown resource")
	}
	out := url.Values{}
	for key, values := range q {
		if len(values) != 1 {
			return nil, fmt.Errorf("duplicate filter")
		}
		value := values[0]
		switch key {
		case "year", "session_key", "driver_number":
			if !f1Number.MatchString(value) {
				return nil, fmt.Errorf("invalid numeric filter")
			}
		case "date>", "date<", "date_start>", "date_start<":
			if _, err := time.Parse(time.RFC3339Nano, value); err != nil {
				return nil, fmt.Errorf("invalid timestamp")
			}
		default:
			return nil, fmt.Errorf("unsupported filter")
		}
		out.Set(key, value)
	}
	if resource == "sessions" {
		if out.Get("year") == "" {
			return nil, fmt.Errorf("year required")
		}
	} else if out.Get("session_key") == "" {
		return nil, fmt.Errorf("session required")
	}
	if resource == "location" || resource == "car_data" {
		if out.Get("date>") == "" || out.Get("date<") == "" {
			return nil, fmt.Errorf("bounded time window required")
		}
		start, _ := time.Parse(time.RFC3339Nano, out.Get("date>"))
		end, _ := time.Parse(time.RFC3339Nano, out.Get("date<"))
		if end.Sub(start) > 2*time.Minute || !end.After(start) {
			return nil, fmt.Errorf("time window must be at most two minutes")
		}
	}
	return out, nil
}
func registerEvents(mux *http.ServeMux) {
	client := &http.Client{Timeout: 18 * time.Second, Transport: f1Transport{os.Getenv("OPENF1_ACCESS_TOKEN"), http.DefaultTransport}}
	var mu sync.Mutex
	feeds := map[string]*aerospaceFeed{}
	mux.HandleFunc("/api/events/f1/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method != http.MethodGet {
			http.Error(w, "GET required", 405)
			return
		}
		resource := strings.TrimPrefix(r.URL.Path, "/api/events/f1/")
		query, err := f1Query(resource, r.URL.Query())
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		key := resource + "?" + query.Encode()
		mu.Lock()
		feed := feeds[key]
		if feed == nil {
			// Eviction bounds memory even when live windows move continuously.
			if len(feeds) >= 128 {
				for old := range feeds {
					delete(feeds, old)
					break
				}
			}
			ttl := 20 * time.Second
			if resource == "sessions" || resource == "drivers" {
				ttl = 5 * time.Minute
			}
			feed = &aerospaceFeed{url: "https://api.openf1.org/v1/" + key, ttl: ttl, client: client}
			feeds[key] = feed
		}
		mu.Unlock()
		feed.ServeHTTP(w, r)
	})
}
