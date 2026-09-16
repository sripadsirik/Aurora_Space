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
