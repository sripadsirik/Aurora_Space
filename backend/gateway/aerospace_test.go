package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestAerospaceCacheAndFailure(t *testing.T) {
	var calls atomic.Int32
	client := &http.Client{Transport: placeTransport(func(r *http.Request) (*http.Response, error) {
		status, body := http.StatusOK, `{"ac":[]}`
		if calls.Add(1) > 1 {
			status, body = http.StatusTooManyRequests, ""
		}
		return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	feed := &aerospaceFeed{url: "https://provider.example/aircraft", ttl: time.Minute, client: client}
	get := func() *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		feed.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
		return w
	}
	if get().Code != 200 || get().Code != 200 || calls.Load() != 1 {
		t.Fatal("cache must coalesce upstream requests")
	}
	old := feed.fetched
	feed.attempted = time.Now().Add(-2 * time.Minute)
	w := get()
	var body struct {
		Stale bool `json:"stale"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)
	if !body.Stale || feed.fetched != old {
		t.Fatal("failure must preserve original timestamp and mark stale")
	}
	get()
	if calls.Load() != 2 {
		t.Fatal("failure must back off")
	}
}
func TestAerospaceUnavailableAndMethods(t *testing.T) {
	client := &http.Client{Transport: placeTransport(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("not json"))}, nil
	})}
	feed := &aerospaceFeed{url: "https://provider.example/aircraft", ttl: time.Minute, client: client}
	w := httptest.NewRecorder()
	feed.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if w.Code != 503 {
		t.Fatal(w.Code)
	}
	w = httptest.NewRecorder()
	feed.ServeHTTP(w, httptest.NewRequest("POST", "/", nil))
	if w.Code != 405 {
		t.Fatal(w.Code)
	}
}
func TestAerospaceHonorsProviderRetryAfter(t *testing.T) {
	var calls atomic.Int32
	feed := &aerospaceFeed{url: "https://provider.example", ttl: time.Second, client: &http.Client{Transport: placeTransport(func(*http.Request) (*http.Response, error) {
		calls.Add(1)
		header := make(http.Header)
		header.Set("Retry-After", "600")
		return &http.Response{StatusCode: 429, Header: header, Body: io.NopCloser(strings.NewReader(`{"detail":"throttled"}`))}, nil
	})}}
	w := httptest.NewRecorder()
	feed.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if w.Code != 503 || !strings.Contains(w.Body.String(), "rate limit") {
		t.Fatal(w.Code, w.Body.String())
	}
	feed.attempted = time.Now().Add(-time.Minute)
	feed.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if calls.Load() != 1 {
		t.Fatal("must respect provider cooldown rather than retry every cache interval")
	}
}

func TestAerospaceHonorsOpenSkyQuotaReset(t *testing.T) {
	var calls atomic.Int32
	feed := &aerospaceFeed{url: "https://opensky-network.org/api/states/all", ttl: time.Minute, client: &http.Client{Transport: placeTransport(func(r *http.Request) (*http.Response, error) {
		calls.Add(1)
		if r.Header.Get("User-Agent") == "" {
			t.Fatal("provider requests must identify Aurora")
		}
		header := make(http.Header)
		header.Set("X-Rate-Limit-Retry-After-Seconds", "3600")
		return &http.Response{StatusCode: 429, Header: header, Body: io.NopCloser(strings.NewReader(`{"error":"quota"}`))}, nil
	})}}
	feed.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	feed.attempted = time.Now().Add(-2 * time.Minute)
	feed.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if calls.Load() != 1 || time.Until(feed.retryAt) < 59*time.Minute {
		t.Fatal("must wait for OpenSky quota reset")
	}
}
