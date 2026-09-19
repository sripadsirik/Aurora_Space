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

func countSatellites(t *testing.T, payload json.RawMessage) int {
	t.Helper()
	var satellites []shared.Satellite
	if err := json.Unmarshal(payload, &satellites); err != nil {
		t.Fatalf("payload is not a satellite array: %v", err)
	}
	return len(satellites)
}

func TestSatelliteBatchAssemblerPassthrough(t *testing.T) {
	a := newSatelliteBatchAssembler()

	// A plain satellite array (no batch envelope) is emitted as-is.
	payload, complete, err := a.ingest([]byte(`[{"noradId":1},{"noradId":2}]`))
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("expected plain array to be complete immediately")
	}
	if n := countSatellites(t, payload); n != 2 {
		t.Errorf("got %d satellites, want 2", n)
	}
}

func TestSatelliteBatchAssemblerSingleBatch(t *testing.T) {
	a := newSatelliteBatchAssembler()

	payload, complete, err := a.ingest([]byte(
		`{"batchId":"x","batchIndex":0,"batchCount":1,"satellites":[{"noradId":10}]}`))
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("expected single-part batch to be complete immediately")
	}
	if n := countSatellites(t, payload); n != 1 {
		t.Errorf("got %d satellites, want 1", n)
	}
}

func TestSatelliteBatchAssemblerInvalid(t *testing.T) {
	a := newSatelliteBatchAssembler()
	if _, _, err := a.ingest([]byte(`not json`)); err == nil {
		t.Fatal("expected error for invalid payload")
	}
}
