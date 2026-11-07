package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Public, published camera catalogs only. No scanning or arbitrary URL proxying.
func registerEarth(mux *http.ServeMux) {
	client := &http.Client{Timeout: 10 * time.Second}
	mux.Handle("/api/earth/cameras/singapore", &aerospaceFeed{url: "https://api.data.gov.sg/v1/transport/traffic-images", ttl: time.Minute, client: client})
	for name, endpoint := range map[string]string{
		"illinois-passage": "https://www.lakecountypassage.com/rest/cctv",
		"london":           "https://api.tfl.gov.uk/Place/Type/JamCam",
		"nsw":              "https://data.livetraffic.com/cameras/traffic-cam.json",
		"finland":          "https://tie.digitraffic.fi/api/weathercam/v1/stations",
	} {
		mux.Handle("/api/earth/cameras/"+name, &aerospaceFeed{url: endpoint, ttl: 5 * time.Minute, client: client})
	}
	for district := 1; district <= 12; district++ {
		mux.Handle(fmt.Sprintf("/api/earth/cameras/california-%d", district), &aerospaceFeed{
			url: fmt.Sprintf("https://cwwp2.dot.ca.gov/data/d%d/cctv/cctvStatusD%02d.json", district, district), ttl: 5 * time.Minute, client: client,
		})
	}
	// Published IDOT / Travel Midwest ArcGIS catalog, ordered and paginated.
	for page := 0; page < 4; page++ {
		mux.Handle(fmt.Sprintf("/api/earth/cameras/illinois-%d", page), &aerospaceFeed{
			url: fmt.Sprintf("https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0/query?where=1%%3D1&outFields=*&outSR=4326&f=json&resultRecordCount=1000&orderByFields=OBJECTID&resultOffset=%d", page*1000), ttl: 5 * time.Minute, client: client,
		})
	}
	mux.Handle("/api/earth/search", newPlaceSearch(client))
}

type placeResult struct {
	body    json.RawMessage
	expires time.Time
}
type placeSearch struct {
	mu          sync.Mutex
	client      *http.Client
	cache       map[string]placeResult
	lastAttempt time.Time
}

func newPlaceSearch(client *http.Client) *placeSearch {
	return &placeSearch{client: client, cache: map[string]placeResult{}}
}
func (p *placeSearch) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(query) < 3 || len(query) > 200 {
		http.Error(w, "Enter a place or street (3–200 characters)", 400)
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	key := strings.ToLower(query)
	if cached, ok := p.cache[key]; ok && now.Before(cached.expires) {
		w.Write(cached.body)
		return
	}
	// Nominatim requires one request per second maximum across all users, caching,
	// app identification and explicit searches rather than autocomplete.
	if now.Sub(p.lastAttempt) < time.Second {
		w.Header().Set("Retry-After", "1")
		http.Error(w, "Search is busy; retry in one second", 429)
		return
	}
	p.lastAttempt = now
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q="+url.QueryEscape(query), nil)
	if err != nil {
		http.Error(w, "Search unavailable", 503)
		return
	}
	request.Header.Set("User-Agent", "Aurora-Space/0.1 (+https://github.com/sripadsirik/Aurora_Space)")
	response, err := p.client.Do(request)
	if err != nil {
		http.Error(w, "Place provider unavailable", 503)
		return
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	var results []json.RawMessage
	if response.StatusCode != 200 || err != nil || json.Unmarshal(body, &results) != nil {
		http.Error(w, "Place provider unavailable", 503)
		return
	}
	if len(p.cache) >= 256 {
		for k := range p.cache {
			delete(p.cache, k)
			break
		}
	}
	p.cache[key] = placeResult{body: body, expires: now.Add(24 * time.Hour)}
	w.Write(body)
}
