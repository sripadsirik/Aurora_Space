package main

import (
	"encoding/json"
	"testing"
)

func TestPayloadCount(t *testing.T) {
	satellites, err := json.Marshal([]map[string]any{
		{"noradId": 1, "name": "A"},
		{"noradId": 2, "name": "B"},
		{"noradId": 3, "name": "C"},
	})
	if err != nil {
		t.Fatalf("marshal satellites: %v", err)
	}
	conjunctions, err := json.Marshal([]map[string]any{
		{"id": "x"},
		{"id": "y"},
	})
	if err != nil {
		t.Fatalf("marshal conjunctions: %v", err)
	}

	cases := []struct {
		name    string
		msgType string
		payload json.RawMessage
		want    int
	}{
		{"space weather with payload counts one", "spaceWeather", json.RawMessage(`{"kpIndex":4}`), 1},
		{"empty space weather counts zero", "spaceWeather", json.RawMessage(``), 0},
		{"satellites counts array length", "satellites", json.RawMessage(satellites), 3},
		{"conjunctions counts array length", "conjunctions", json.RawMessage(conjunctions), 2},
		{"malformed satellites counts zero", "satellites", json.RawMessage(`not json`), 0},
		{"unknown type counts zero", "mystery", json.RawMessage(`[1,2,3]`), 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := payloadCount(tc.msgType, tc.payload); got != tc.want {
				t.Errorf("payloadCount(%q, ...) = %d, want %d", tc.msgType, got, tc.want)
			}
		})
	}
}
