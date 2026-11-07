package main

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestOMMPropagationAndEpochOrdering(t *testing.T) {
	b, e := os.ReadFile("../internal/sgp4/testdata/vallado.json")
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
	r := f.Cases[0].OMM
	r.NoradCatID = 100001
	epoch, _ := r.OMMEpoch()
	s, ok := propagateSatelliteAt(r, epoch)
	if !ok || s.OMM == nil || s.NoradID != 100001 {
		t.Fatal("six-digit OMM not propagated")
	}
	cache := &tleCache{records: make(map[string]gpRecord)}
	cache.set("100001", r)
	older := r
	older.Epoch = epoch.Add(-time.Hour).Format(time.RFC3339Nano)
	cache.set("100001", older)
	if cache.snapshot()[0].Epoch != r.Epoch {
		t.Fatal("older elements overwrote newer OMM")
	}
}
