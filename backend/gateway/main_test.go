package main

import (
	"encoding/json"
	"testing"
)

func TestPayloadCount(t *testing.T) {
	satellites, _ := json.Marshal([]map[string]any{
		{"noradId": 1},
		{"noradId": 2},
		{"noradId": 3},
	})
	conjunctions, _ := json.Marshal([]map[string]any{{"id": "a"}})

	tests := []struct {
		name    string
		msgType string
		payload json.RawMessage
		want    int
	}{
		{"space weather with payload counts as one", "spaceWeather", json.RawMessage(`{"kpIndex":5}`), 1},
		{"empty space weather counts as zero", "spaceWeather", json.RawMessage(``), 0},
		{"satellites counts array length", "satellites", satellites, 3},
		{"conjunctions counts array length", "conjunctions", conjunctions, 1},
		{"malformed satellites counts as zero", "satellites", json.RawMessage(`not json`), 0},
		{"unknown type counts as zero", "mystery", json.RawMessage(`[1,2,3]`), 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := payloadCount(tt.msgType, tt.payload); got != tt.want {
				t.Errorf("payloadCount(%q, %s) = %d, want %d", tt.msgType, tt.payload, got, tt.want)
			}
		})
	}
}

func TestStateCacheSetAndSnapshot(t *testing.T) {
	cache := &stateCache{}
	satellites := json.RawMessage(`[{"noradId":1},{"noradId":2}]`)

	cache.set("satellites", satellites)

	snap := cache.snapshot()
	if snap.satellites.count != 2 {
		t.Errorf("satellites count = %d, want 2", snap.satellites.count)
	}
	if string(snap.satellites.payload) != string(satellites) {
		t.Errorf("satellites payload = %s, want %s", snap.satellites.payload, satellites)
	}
	if snap.satellites.lastUpdated.IsZero() {
		t.Error("lastUpdated should be set after set()")
	}
	if snap.conjunctions.count != 0 || snap.conjunctions.payload != nil {
		t.Error("untouched feeds should remain empty")
	}
}

func TestStateCacheSetIgnoresUnknownType(t *testing.T) {
	cache := &stateCache{}
	cache.set("mystery", json.RawMessage(`[1,2,3]`))

	snap := cache.snapshot()
	if snap.satellites.payload != nil || snap.conjunctions.payload != nil || snap.spaceWeather.payload != nil {
		t.Error("unknown message type must not populate any feed")
	}
}
