package main

import (
	"encoding/json"
	"testing"

	"github.com/sripadsirik/aurora/shared"
)

func TestPayloadCount(t *testing.T) {
	satellites, _ := json.Marshal([]shared.Satellite{{NoradID: 1}, {NoradID: 2}, {NoradID: 3}})
	conjunctions, _ := json.Marshal([]shared.ConjunctionWarning{{ID: "a"}, {ID: "b"}})

	cases := []struct {
		name    string
		msgType string
		payload json.RawMessage
		want    int
	}{
		{"space weather with payload counts as one", "spaceWeather", json.RawMessage(`{"kpIndex":5}`), 1},
		{"space weather empty payload counts as zero", "spaceWeather", json.RawMessage(``), 0},
		{"satellites counts array length", "satellites", satellites, 3},
		{"empty satellites array", "satellites", json.RawMessage(`[]`), 0},
		{"malformed satellites returns zero", "satellites", json.RawMessage(`{bad`), 0},
		{"conjunctions counts array length", "conjunctions", conjunctions, 2},
		{"unknown type returns zero", "mystery", json.RawMessage(`[1,2,3]`), 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := payloadCount(tc.msgType, tc.payload); got != tc.want {
				t.Errorf("payloadCount(%q, %s) = %d, want %d", tc.msgType, tc.payload, got, tc.want)
			}
		})
	}
}
