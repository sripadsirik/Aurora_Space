package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestF1QueryBoundaries(t *testing.T) {
	for _, test := range []struct {
		resource, query string
		valid           bool
	}{
		{"sessions", "year=2026", true},
		{"drivers", "session_key=9858", true},
		{"location", "session_key=9858&date%3E=2025-11-23T04:05:00Z&date%3C=2025-11-23T04:07:00Z", true},
		{"location", "session_key=9858", false},
		{"location", "session_key=9858&date%3E=2025-11-23T04:00:00Z&date%3C=2025-11-23T06:00:00Z", false},
		{"drivers", "session_key=latest&url=http://localhost", false},
		{"../location", "session_key=1", false},
		{"sessions", "year=2026&year=2027", false},
	} {
		q, _ := url.ParseQuery(test.query)
		_, err := f1Query(test.resource, q)
		if (err == nil) != test.valid {
			t.Errorf("%s %s: %v", test.resource, test.query, err)
		}
	}
}
func TestF1ProxyRejectsInvalidBeforeNetwork(t *testing.T) {
	mux := http.NewServeMux()
	registerEvents(mux)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/events/f1/location?session_key=1", nil))
	if w.Code != 400 || !strings.Contains(w.Body.String(), "bounded") {
		t.Fatalf("unexpected %d %s", w.Code, w.Body)
	}
}
func TestF1TransportAddsTokenWithoutMutatingRequest(t *testing.T) {
	r := httptest.NewRequest("GET", "https://api.openf1.org/v1/drivers", nil)
	tr := f1Transport{token: "test-token", base: placeTransport(func(got *http.Request) (*http.Response, error) {
		if got.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing token")
		}
		return &http.Response{StatusCode: 200, Body: http.NoBody}, nil
	})}
	_, err := tr.RoundTrip(r)
	if err != nil {
		t.Fatal(err)
	}
	if r.Header.Get("Authorization") != "" {
		t.Fatal("original request mutated")
	}
}

func TestF1TransportNeverForwardsTokenToRedirectHost(t *testing.T) {
	tr := f1Transport{token: "test-token", base: placeTransport(func(got *http.Request) (*http.Response, error) {
		if got.Header.Get("Authorization") != "" {
			t.Error("token leaked to another host")
		}
		return &http.Response{StatusCode: 200, Body: http.NoBody}, nil
	})}
	_, err := tr.RoundTrip(httptest.NewRequest("GET", "https://elsewhere.example/redirect", nil))
	if err != nil {
		t.Fatal(err)
	}
}
