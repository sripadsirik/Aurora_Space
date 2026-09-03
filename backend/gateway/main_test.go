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

func TestSatelliteBatchAssemblerSingleBatch(t *testing.T) {
	a := newSatelliteBatchAssembler()
	batch := shared.SatelliteBatch{
		BatchID:    "b1",
		BatchIndex: 0,
		BatchCount: 1,
		Satellites: []shared.Satellite{{NoradID: 10}, {NoradID: 20}},
	}
	data, _ := json.Marshal(batch)

	payload, complete, err := a.ingest(data)
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("single batch should complete immediately")
	}

	var sats []shared.Satellite
	if err := json.Unmarshal(payload, &sats); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if len(sats) != 2 {
		t.Errorf("got %d satellites, want 2", len(sats))
	}
}

func TestSatelliteBatchAssemblerRawArray(t *testing.T) {
	a := newSatelliteBatchAssembler()
	data, _ := json.Marshal([]shared.Satellite{{NoradID: 1}})

	payload, complete, err := a.ingest(data)
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("raw satellite array should complete immediately")
	}
	if string(payload) != string(data) {
		t.Errorf("payload = %s, want passthrough %s", payload, data)
	}
}

func TestSatelliteBatchAssemblerMultiPart(t *testing.T) {
	a := newSatelliteBatchAssembler()
	part0, _ := json.Marshal(shared.SatelliteBatch{
		BatchID: "multi", BatchIndex: 0, BatchCount: 2,
		Satellites: []shared.Satellite{{NoradID: 1}},
	})
	part1, _ := json.Marshal(shared.SatelliteBatch{
		BatchID: "multi", BatchIndex: 1, BatchCount: 2,
		Satellites: []shared.Satellite{{NoradID: 2}, {NoradID: 3}},
	})

	if _, complete, err := a.ingest(part0); err != nil || complete {
		t.Fatalf("first part: complete=%v err=%v, want incomplete", complete, err)
	}

	payload, complete, err := a.ingest(part1)
	if err != nil {
		t.Fatalf("second part returned error: %v", err)
	}
	if !complete {
		t.Fatal("batch should complete once all parts arrive")
	}

	var sats []shared.Satellite
	if err := json.Unmarshal(payload, &sats); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if len(sats) != 3 {
		t.Errorf("got %d satellites, want 3 (1 + 2 across parts)", len(sats))
	}
}

func TestSatelliteBatchAssemblerInvalidPayload(t *testing.T) {
	a := newSatelliteBatchAssembler()
	if _, _, err := a.ingest([]byte("{not valid json")); err == nil {
		t.Fatal("expected error for invalid payload")
	}
}
