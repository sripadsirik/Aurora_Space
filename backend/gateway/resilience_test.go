package main

import (
	"encoding/json"
	"sync"
	"testing"
	"time"
)

func TestReplayedSatelliteSnapshotRetainsSourceEpoch(t *testing.T) {
	cache := &stateCache{}
	cache.set("satellites", json.RawMessage(`[{"noradId":1,"positionTimestamp":"2025-01-01T00:00:00Z"}]`))
	feed := cache.snapshot().satellites
	if feed.lastUpdated.Year() != 2025 || buildEngineRow(trackedProcessSnapshot{}, feed).Status == "LIVE" {
		t.Fatal("historical Kafka replay was presented as live")
	}
	cache.set("satellites", json.RawMessage(`[{"noradId":1}]`))
	if !cache.snapshot().satellites.lastUpdated.Equal(time.Time{}) {
		t.Fatal("missing epoch fabricated freshness")
	}
}

func TestSlowClientDisconnectsAndHealthyClientReceives(t *testing.T) {
	h := newHub()
	slow := &client{send: make(chan []byte, 1)}
	healthy := &client{send: make(chan []byte, 4)}
	h.register(slow)
	h.register(healthy)
	h.broadcast("satellites", json.RawMessage(`[]`))
	h.broadcast("spaceWeather", json.RawMessage(`{"kpIndex":2}`))
	if h.count() != 1 {
		t.Fatalf("slow client not removed: %d", h.count())
	}
	<-slow.send
	if _, open := <-slow.send; open {
		t.Fatal("slow queue remains open")
	}
	if len(healthy.send) != 2 {
		t.Fatal("healthy client lost data")
	}
	h.unregister(slow)
	h.unregister(healthy)
}
func TestConcurrentBroadcastDisconnect(t *testing.T) {
	h := newHub()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := &client{send: make(chan []byte, 1)}
			h.register(c)
			h.broadcast("satellites", json.RawMessage(`[]`))
			h.unregister(c)
		}()
	}
	wg.Wait()
	if h.count() != 0 {
		t.Fatal("client leak")
	}
}
func TestWeatherSnapshotsRetainSourceTime(t *testing.T) {
	cache := &stateCache{}
	cache.set("spaceWeather", json.RawMessage(`{"lastUpdated":"2026-11-05T14:06:01Z"}`))
	first := cache.snapshot().spaceWeather.lastUpdated
	cache.set("spaceWeather", json.RawMessage(`{"lastUpdated":"2026-11-05T14:06:01Z"}`))
	if !cache.snapshot().spaceWeather.lastUpdated.Equal(first) || first.Hour() != 14 || first.Minute() != 6 {
		t.Fatal("cache delivery must not refresh source timestamps")
	}
}
