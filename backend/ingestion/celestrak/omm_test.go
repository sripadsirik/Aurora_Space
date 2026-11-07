package main

import (
	"encoding/json"
	"os"
	"testing"
)

func TestOMMIngestionAndSixDigitIdentity(t *testing.T) {
	b, e := os.ReadFile("../../internal/sgp4/testdata/vallado.json")
	if e != nil {
		t.Fatal(e)
	}
	var f struct {
		Cases []struct {
			OMM gpRecord `json:"omm"`
		} `json:"cases"`
	}
	if json.Unmarshal(b, &f) != nil {
		t.Fatal("fixture")
	}
	rec := f.Cases[0].OMM
	rec.NoradCatID = 100001
	b, _ = json.Marshal([]gpRecord{rec})
	out := parseGPData(b)
	if len(out) != 1 || out[0].NoradCatID != 100001 || out[0].TLELine1 != "" {
		t.Fatal("OMM not preserved")
	}
	rec.RefFrame = "GCRF"
	b, _ = json.Marshal([]gpRecord{rec})
	if len(parseGPData(b)) != 0 {
		t.Fatal("wrong frame accepted")
	}
	if len(parseGPData([]byte(`[{"NORAD_CAT_ID":100001,"EPOCH":"2026-10-26T00:00:00Z","MEAN_MOTION":15}]`))) != 0 {
		t.Fatal("missing fields accepted")
	}
}
