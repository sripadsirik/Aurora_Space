package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRocketTelemetryRequiresAConfiguredProvider(t *testing.T) {
	mux := http.NewServeMux()
	registerRocketTelemetryWithClient(mux, &http.Client{}, "")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/aerospace/telemetry/mission", nil))
	if w.Code != 503 || !strings.Contains(w.Body.String(), "not_connected") {
		t.Fatal(w.Code, w.Body.String())
	}
}
func TestRocketTelemetryBindsMissionToConfiguredHostAndCaches(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: placeTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.Host != "provider.example" || r.URL.Query().Get("missionId") != "mission" {
			t.Fatal(r.URL)
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"missionId":"mission","positionType":"observed","source":"Test provider","positions":[]}`))}, nil
	})}
	mux := http.NewServeMux()
	registerRocketTelemetryWithClient(mux, client, "https://provider.example/live")
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/aerospace/telemetry/mission", nil))
		if w.Code != 200 {
			t.Fatal(w.Code)
		}
	}
	if calls != 1 {
		t.Fatal("duplicate viewers must share a provider cache")
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/aerospace/telemetry/not:a:mission?upstream=https://elsewhere.example", nil))
	if w.Code != 400 || calls != 1 {
		t.Fatalf("invalid mission must not fetch a different upstream: status=%d calls=%d", w.Code, calls)
	}
}
