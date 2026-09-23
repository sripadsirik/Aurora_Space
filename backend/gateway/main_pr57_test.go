package main

import (
	"encoding/json"
	"testing"
)

func TestPayloadCountPR57(t *testing.T) {
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

func TestStateCacheSetAndSnapshotPR57(t *testing.T) {
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

func TestStateCacheSetIgnoresUnknownTypePR57(t *testing.T) {
	cache := &stateCache{}
	cache.set("mystery", json.RawMessage(`[1,2,3]`))

	snap := cache.snapshot()
	if snap.satellites.payload != nil || snap.conjunctions.payload != nil || snap.spaceWeather.payload != nil {
		t.Error("unknown message type must not populate any feed")
	}
}

func TestSatelliteBatchAssemblerPlainArrayPR57(t *testing.T) {
	a := newSatelliteBatchAssembler()
	data := []byte(`[{"noradId":1,"name":"A"},{"noradId":2,"name":"B"}]`)

	payload, complete, err := a.ingest(data)
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("plain array should be immediately complete")
	}
	if string(payload) != string(data) {
		t.Errorf("payload = %s, want passthrough of input", payload)
	}
}

func TestSatelliteBatchAssemblerSingleBatchPR57(t *testing.T) {
	a := newSatelliteBatchAssembler()
	data := []byte(`{"batchId":"x","batchIndex":0,"batchCount":1,"satellites":[{"noradId":7,"name":"solo"}]}`)

	payload, complete, err := a.ingest(data)
	if err != nil {
		t.Fatalf("ingest returned error: %v", err)
	}
	if !complete {
		t.Fatal("single batch should be complete")
	}

	var satellites []map[string]any
	if err := json.Unmarshal(payload, &satellites); err != nil {
		t.Fatalf("payload not a satellite array: %v", err)
	}
	if len(satellites) != 1 {
		t.Errorf("got %d satellites, want 1", len(satellites))
	}
}

func TestSatelliteBatchAssemblerMultiBatchPR57(t *testing.T) {
	a := newSatelliteBatchAssembler()
	part0 := []byte(`{"batchId":"m","batchIndex":0,"batchCount":2,"satellites":[{"noradId":1,"name":"A"}]}`)
	part1 := []byte(`{"batchId":"m","batchIndex":1,"batchCount":2,"satellites":[{"noradId":2,"name":"B"}]}`)

	if _, complete, err := a.ingest(part0); err != nil || complete {
		t.Fatalf("first part: complete=%v err=%v, want incomplete", complete, err)
	}

	payload, complete, err := a.ingest(part1)
	if err != nil {
		t.Fatalf("second part returned error: %v", err)
	}
	if !complete {
		t.Fatal("batch should be complete after final part")
	}

	var satellites []map[string]any
	if err := json.Unmarshal(payload, &satellites); err != nil {
		t.Fatalf("payload not a satellite array: %v", err)
	}
	if len(satellites) != 2 {
		t.Errorf("got %d satellites, want 2 assembled across parts", len(satellites))
	}
}

func TestSatelliteBatchAssemblerInvalidDataPR57(t *testing.T) {
	a := newSatelliteBatchAssembler()
	if _, _, err := a.ingest([]byte(`not json at all`)); err == nil {
		t.Error("expected error for unparseable input")
	}
}
