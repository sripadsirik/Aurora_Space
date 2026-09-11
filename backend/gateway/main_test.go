package main

import (
	"encoding/json"
	"testing"

	"github.com/sripadsirik/aurora/shared"
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

func decodeSatelliteIDs(t *testing.T, payload json.RawMessage) []int {
	t.Helper()
	var sats []shared.Satellite
	if err := json.Unmarshal(payload, &sats); err != nil {
		t.Fatalf("unmarshal reassembled payload: %v", err)
	}
	ids := make([]int, len(sats))
	for i, s := range sats {
		ids[i] = s.NoradID
	}
	return ids
}

func TestSatelliteBatchAssemblerPassThrough(t *testing.T) {
	a := newSatelliteBatchAssembler()

	t.Run("a bare satellite array passes straight through", func(t *testing.T) {
		payload, complete, err := a.ingest([]byte(`[{"noradId":1},{"noradId":2}]`))
		if err != nil || !complete {
			t.Fatalf("ingest = (complete=%v, err=%v), want (true, nil)", complete, err)
		}
		if ids := decodeSatelliteIDs(t, payload); len(ids) != 2 {
			t.Errorf("got %d satellites, want 2", len(ids))
		}
	})

	t.Run("a single-batch envelope completes immediately", func(t *testing.T) {
		payload, complete, err := a.ingest([]byte(`{"batchId":"b","batchIndex":0,"batchCount":1,"satellites":[{"noradId":7}]}`))
		if err != nil || !complete {
			t.Fatalf("ingest = (complete=%v, err=%v), want (true, nil)", complete, err)
		}
		if ids := decodeSatelliteIDs(t, payload); len(ids) != 1 || ids[0] != 7 {
			t.Errorf("got ids %v, want [7]", ids)
		}
	})

	t.Run("invalid JSON returns an error", func(t *testing.T) {
		if _, _, err := a.ingest([]byte(`{not valid`)); err == nil {
			t.Error("expected an error for malformed input")
		}
	})
}
