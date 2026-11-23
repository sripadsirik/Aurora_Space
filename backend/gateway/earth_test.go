package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type placeTransport func(*http.Request) (*http.Response, error)

func TestEarthRegistersDirectPassageCatalog(t *testing.T) {
	mux := http.NewServeMux()
	registerEarth(mux)
	handler, _ := mux.Handler(httptest.NewRequest(http.MethodGet, "/api/earth/cameras/illinois-passage", nil))
	feed, ok := handler.(*aerospaceFeed)
	if !ok || feed.url != "https://www.lakecountypassage.com/rest/cctv" {
		t.Fatal("direct Lake County catalog must use the fixed public endpoint")
	}
}

func (f placeTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestPlaceSearchCacheLimitsAndFixedProvider(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: placeTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.Host != "nominatim.openstreetmap.org" || r.URL.Query().Get("q") != "London bridge" || !strings.Contains(r.Header.Get("User-Agent"), "Aurora-Space") {
			t.Fatal("unexpected outbound request", r.URL)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`[{"display_name":"London Bridge","lat":"51.5","lon":"-0.1"}]`)), Header: make(http.Header)}, nil
	})}
	search := newPlaceSearch(client)
	get := func(path string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		search.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		return w
	}
	if get("/api/earth/search?q=London+bridge").Code != 200 || get("/api/earth/search?q=London+bridge").Code != 200 || calls != 1 {
		t.Fatal("searches must be cached")
	}
	if got := get("/api/earth/search?q=Paris"); got.Code != 429 || got.Header().Get("Retry-After") != "1" {
		t.Fatal("must throttle distinct requests", got.Code)
	}
	if get("/api/earth/search?q=x").Code != 400 {
		t.Fatal("must reject short queries")
	}
	w := httptest.NewRecorder()
	search.ServeHTTP(w, httptest.NewRequest("POST", "/api/earth/search?q=London", nil))
	if w.Code != 405 {
		t.Fatal(w.Code)
	}
}
func TestPlaceSearchRejectsProviderErrors(t *testing.T) {
	search := newPlaceSearch(&http.Client{Transport: placeTransport(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"unexpected":"shape"}`)), Header: make(http.Header)}, nil
	})})
	w := httptest.NewRecorder()
	search.ServeHTTP(w, httptest.NewRequest("GET", "/api/earth/search?q=London", nil))
	if w.Code != 503 {
		t.Fatal("invalid provider data must remain unavailable", w.Code)
	}
}

func TestRoadCameraCatalogs(t *testing.T) {
	for _, tc := range []struct{ body, id string }{
		{`<image-list><image><key>H210F</key><description>Tunnel</description><latitude>22.27</latitude><longitude>114.18</longitude><url>https://tdcctv.data.one.gov.hk/H210F.JPG</url></image></image-list>`, "H210F"},
		{`<p:GetCamerasResponse xmlns:p="nz"><p:camera><p:id>714</p:id><p:lat>-43.92</p:lat><p:lon>171.72</p:lon><p:imageUrl>http://www.trafficnz.info/camera/714.jpg</p:imageUrl></p:camera><p:camera><p:id>715</p:id><p:lat>-43</p:lat><p:lon>171</p:lon><p:offline>true</p:offline></p:camera></p:GetCamerasResponse>`, "714"},
	} {
		data, err := roadCameraXML([]byte(tc.body))
		var views []roadSnapshot
		if err != nil || json.Unmarshal(data, &views) != nil || len(views) != 1 || views[0].ID != tc.id || !strings.HasPrefix(views[0].Image, "https://") {
			t.Fatalf("unexpected camera response for %s: %s (%v)", tc.id, data, err)
		}
	}
	if _, err := roadCameraXML([]byte("<html/>")); err == nil {
		t.Fatal("accepted an error page as a catalog")
	}
}
