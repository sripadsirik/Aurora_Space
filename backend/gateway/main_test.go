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

func TestSatelliteBatchAssemblerSingle(t *testing.T) {
	t.Run("plain satellite array passes through", func(t *testing.T) {
		a := newSatelliteBatchAssembler()
		raw := []byte(`[{"noradId":1,"name":"A"},{"noradId":2,"name":"B"}]`)
		payload, complete, err := a.ingest(raw)
		if err != nil {
			t.Fatalf("ingest returned error: %v", err)
		}
		if !complete {
			t.Fatal("plain array should complete immediately")
		}
		if string(payload) != string(raw) {
			t.Errorf("payload = %s, want passthrough %s", payload, raw)
		}
	})

	t.Run("single-part batch emits its satellites", func(t *testing.T) {
		a := newSatelliteBatchAssembler()
		raw := []byte(`{"batchId":"b1","batchIndex":0,"batchCount":1,"satellites":[{"noradId":9,"name":"Z"}]}`)
		payload, complete, err := a.ingest(raw)
		if err != nil {
			t.Fatalf("ingest returned error: %v", err)
		}
		if !complete {
			t.Fatal("single-part batch should complete immediately")
		}
		var sats []map[string]any
		if err := json.Unmarshal(payload, &sats); err != nil {
			t.Fatalf("payload not a satellite array: %v", err)
		}
		if len(sats) != 1 {
			t.Errorf("expected 1 satellite, got %d", len(sats))
		}
	})

	t.Run("invalid json returns error", func(t *testing.T) {
		a := newSatelliteBatchAssembler()
		if _, _, err := a.ingest([]byte(`not json`)); err == nil {
			t.Error("expected error for invalid json")
		}
	})
}
