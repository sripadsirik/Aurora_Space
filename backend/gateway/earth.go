package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// The two agencies publish one XML element per directional road view.
type roadViewXML struct {
	ID          string   `xml:"id"`
	Key         string   `xml:"key"`
	Name        string   `xml:"name"`
	Description string   `xml:"description"`
	Lat         *float64 `xml:"lat"`
	Lon         *float64 `xml:"lon"`
	Latitude    *float64 `xml:"latitude"`
	Longitude   *float64 `xml:"longitude"`
	ImageURL    string   `xml:"imageUrl"`
	URL         string   `xml:"url"`
	Offline     bool     `xml:"offline"`
	Maintenance bool     `xml:"underMaintenance"`
}
type roadSnapshot struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Lat   float64 `json:"lat"`
	Lon   float64 `json:"lon"`
	Image string  `json:"image"`
}

func roadCameraXML(body []byte) ([]byte, error) {
	var catalog struct {
		XMLName xml.Name
		Cameras []roadViewXML `xml:"camera"`
		Images  []roadViewXML `xml:"image"`
	}
	if err := xml.Unmarshal(body, &catalog); err != nil {
		return nil, err
	}
	views := make([]roadSnapshot, 0)
	switch catalog.XMLName.Local {
	case "image-list":
		for _, v := range catalog.Images {
			if v.Key != "" && v.Latitude != nil && v.Longitude != nil {
				views = append(views, roadSnapshot{v.Key, v.Description, *v.Latitude, *v.Longitude, v.URL})
			}
		}
	case "GetCamerasResponse":
		for _, v := range catalog.Cameras {
			if v.ID != "" && !v.Offline && !v.Maintenance && v.Lat != nil && v.Lon != nil {
				image := strings.Replace(v.ImageURL, "http://www.trafficnz.info/", "https://www.trafficnz.info/", 1)
				views = append(views, roadSnapshot{v.ID, v.Name, *v.Lat, *v.Lon, image})
			}
		}
	default:
		return nil, fmt.Errorf("unexpected camera catalog %q", catalog.XMLName.Local)
	}
	return json.Marshal(views)
}

// Public, published camera catalogs only. No scanning or arbitrary URL proxying.
func registerEarth(mux *http.ServeMux) {
	client := &http.Client{Timeout: 10 * time.Second}
	mux.Handle("/api/earth/cameras/singapore", &aerospaceFeed{url: "https://api.data.gov.sg/v1/transport/traffic-images", ttl: time.Minute, client: client})
	for name, endpoint := range map[string]string{
		"british-columbia": "https://www.drivebc.ca/api/webcams/",
		"illinois-passage": "https://www.lakecountypassage.com/rest/cctv",
		"london":           "https://api.tfl.gov.uk/Place/Type/JamCam",
		"nsw":              "https://data.livetraffic.com/cameras/traffic-cam.json",
		"finland":          "https://tie.digitraffic.fi/api/weathercam/v1/stations",
	} {
		mux.Handle("/api/earth/cameras/"+name, &aerospaceFeed{url: endpoint, ttl: 5 * time.Minute, client: client})
	}
	for name, endpoint := range map[string]string{
		"hong-kong":   "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml",
		"new-zealand": "https://trafficnz.info/service/traffic-cameras/rest/2",
	} {
		mux.Handle("/api/earth/cameras/"+name, &aerospaceFeed{url: endpoint, ttl: 5 * time.Minute, client: client, decode: roadCameraXML})
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
