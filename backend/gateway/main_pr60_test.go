package main

import (
	"encoding/json"
	"testing"

	"github.com/sripadsirik/aurora/shared"
)

func TestPayloadCountPR60(t *testing.T) {
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

func countSatellitesPR60(t *testing.T, payload json.RawMessage) int {
	t.Helper()
	var satellites []shared.Satellite
	if err := json.Unmarshal(payload, &satellites); err != nil {
		t.Fatalf("payload is not a satellite array: %v", err)
	}
	return len(satellites)
}

func TestSatelliteBatchAssemblerPassthroughPR60(t *testing.T) {
	a := newSatelliteBatchAssembler()

	// A plain satellite array (no batch envelope) is emitted as-is.
	payload, complete, err := a.ingest([]byte(`[{"noradId":1},{"noradId":2}]`))
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("expected plain array to be complete immediately")
	}
	if n := countSatellitesPR60(t, payload); n != 2 {
		t.Errorf("got %d satellites, want 2", n)
	}
}

func TestSatelliteBatchAssemblerSingleBatchPR60(t *testing.T) {
	a := newSatelliteBatchAssembler()

	payload, complete, err := a.ingest([]byte(
		`{"batchId":"x","batchIndex":0,"batchCount":1,"satellites":[{"noradId":10}]}`))
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("expected single-part batch to be complete immediately")
	}
	if n := countSatellitesPR60(t, payload); n != 1 {
		t.Errorf("got %d satellites, want 1", n)
	}
}

func TestSatelliteBatchAssemblerInvalidPR60(t *testing.T) {
	a := newSatelliteBatchAssembler()
	if _, _, err := a.ingest([]byte(`not json`)); err == nil {
		t.Fatal("expected error for invalid payload")
	}
}

func TestSatelliteBatchAssemblerMultiPartPR60(t *testing.T) {
	a := newSatelliteBatchAssembler()

	// First part of a two-part batch: not complete yet.
	payload, complete, err := a.ingest([]byte(
		`{"batchId":"b","batchIndex":0,"batchCount":2,"satellites":[{"noradId":1}]}`))
	if err != nil {
		t.Fatalf("ingest part 0 returned error: %v", err)
	}
	if complete || payload != nil {
		t.Fatalf("expected incomplete batch after first part, got complete=%v payload=%v", complete, payload)
	}

	// Second part completes the batch and yields the merged, index-ordered set.
	payload, complete, err = a.ingest([]byte(
		`{"batchId":"b","batchIndex":1,"batchCount":2,"satellites":[{"noradId":2},{"noradId":3}]}`))
	if err != nil {
		t.Fatalf("ingest part 1 returned error: %v", err)
	}
	if !complete {
		t.Fatal("expected batch to be complete after final part")
	}
	if n := countSatellitesPR60(t, payload); n != 3 {
		t.Errorf("got %d satellites, want 3", n)
	}
}
