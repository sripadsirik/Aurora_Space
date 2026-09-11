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
		{"space weather present counts as one", "spaceWeather", `{"kpIndex":5}`, 1},
		{"empty space weather payload counts as zero", "spaceWeather", ``, 0},
		{"satellite array length", "satellites", `[{"noradId":1},{"noradId":2},{"noradId":3}]`, 3},
		{"empty satellite array", "satellites", `[]`, 0},
		{"malformed satellite payload counts as zero", "satellites", `not json`, 0},
		{"conjunction array length", "conjunctions", `[{"id":"a"},{"id":"b"}]`, 2},
		{"malformed conjunction payload counts as zero", "conjunctions", `{`, 0},
		{"unknown message type counts as zero", "connected", `{"serverTime":"now"}`, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := payloadCount(tc.msgType, json.RawMessage(tc.payload))
			if got != tc.want {
				t.Errorf("payloadCount(%q, %q) = %d, want %d", tc.msgType, tc.payload, got, tc.want)
			}
		})
	}
}
