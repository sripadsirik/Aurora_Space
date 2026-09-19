package main

import (
	"encoding/json"
	"testing"
)

func TestPayloadCount(t *testing.T) {
	cases := []struct {
		name    string
		msgType string
		payload string
		want    int
	}{
		{"spaceWeather present", "spaceWeather", `{"kpIndex":5}`, 1},
		{"spaceWeather empty", "spaceWeather", ``, 0},
		{"satellites counts array", "satellites", `[{"noradId":1},{"noradId":2},{"noradId":3}]`, 3},
		{"satellites empty array", "satellites", `[]`, 0},
		{"satellites invalid json", "satellites", `not json`, 0},
		{"conjunctions counts array", "conjunctions", `[{"id":"a"},{"id":"b"}]`, 2},
		{"unknown type", "connected", `{"anything":true}`, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := payloadCount(tc.msgType, json.RawMessage(tc.payload))
			if got != tc.want {
				t.Errorf("payloadCount(%q, %s) = %d, want %d", tc.msgType, tc.payload, got, tc.want)
			}
		})
	}
}
