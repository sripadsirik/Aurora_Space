package main

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sync"
	"time"
)

// This input is configured by the server operator, never an arbitrary client URL.
// Provider samples must carry absolute observation times and their LL2 mission ID.
func registerRocketTelemetry(mux *http.ServeMux) {
	registerRocketTelemetryWithClient(mux, &http.Client{Timeout: 5 * time.Second}, os.Getenv("ROCKET_TELEMETRY_URL"))
}
func registerRocketTelemetryWithClient(mux *http.ServeMux, client *http.Client, source string) {
	endpoint, parseErr := url.Parse(source)
	valid := source != "" && parseErr == nil && (endpoint.Scheme == "https" || endpoint.Scheme == "http") && endpoint.Host != "" && endpoint.User == nil
	var mu sync.Mutex
	feeds := map[string]*aerospaceFeed{}
	missionPattern := regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)
	mux.HandleFunc("/api/aerospace/telemetry/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet {
			w.WriteHeader(405)
			return
		}
		mission := r.URL.Path[len("/api/aerospace/telemetry/"):]
		if !missionPattern.MatchString(mission) {
			http.Error(w, "Invalid mission ID", 400)
			return
		}
		if !valid {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"error": "No live rocket position provider is configured", "status": "not_connected"})
			return
		}
		mu.Lock()
		feed := feeds[mission]
		if feed == nil {
			if len(feeds) >= 32 {
				for id := range feeds {
					delete(feeds, id)
					break
				}
			}
			upstream := *endpoint
			q := upstream.Query()
			q.Set("missionId", mission)
			upstream.RawQuery = q.Encode()
			feed = &aerospaceFeed{url: upstream.String(), ttl: time.Second, client: client}
			feeds[mission] = feed
		}
		mu.Unlock()
		feed.ServeHTTP(w, r)
	})
}
