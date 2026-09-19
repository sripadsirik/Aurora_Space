package main

import (
	"encoding/json"
	"testing"
)

// Valid 69-character ISS TLE lines used to build test records.
const (
	issLine1 = "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927"
	issLine2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537"
)

func validRecord() gpRecord {
	return gpRecord{
		NoradCatID:   25544,
		TLELine1:     issLine1,
		TLELine2:     issLine2,
		MeanMotion:   15.72125391,
		Eccentricity: 0.0006703,
	}
}

func TestIsTLEValid(t *testing.T) {
	t.Run("accepts a well-formed record", func(t *testing.T) {
		if !isTLEValid(validRecord()) {
			t.Error("expected valid record to pass")
		}
	})

	cases := []struct {
		name   string
		mutate func(*gpRecord)
	}{
		{"line1 too short", func(r *gpRecord) { r.TLELine1 = "1 25544" }},
		{"line2 too short", func(r *gpRecord) { r.TLELine2 = "2 25544" }},
		{"line1 wrong prefix", func(r *gpRecord) { r.TLELine1 = "9" + issLine1[1:] }},
		{"line2 wrong prefix", func(r *gpRecord) { r.TLELine2 = "9" + issLine2[1:] }},
		{"eccentricity at unity", func(r *gpRecord) { r.Eccentricity = 1.0 }},
		{"negative eccentricity", func(r *gpRecord) { r.Eccentricity = -0.1 }},
		{"near-parabolic eccentricity", func(r *gpRecord) { r.Eccentricity = 0.95 }},
		{"zero mean motion", func(r *gpRecord) { r.MeanMotion = 0 }},
		{"negative mean motion", func(r *gpRecord) { r.MeanMotion = -1 }},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := validRecord()
			tc.mutate(&rec)
			if isTLEValid(rec) {
				t.Errorf("expected record to be rejected: %s", tc.name)
			}
		})
	}
}

func TestIngestTLE(t *testing.T) {
	t.Run("stores a valid record", func(t *testing.T) {
		cache := &tleCache{records: make(map[string]gpRecord)}
		data, _ := json.Marshal(validRecord())

		if !ingestTLE(data, cache) {
			t.Fatal("expected ingestTLE to accept a valid record")
		}
		if cache.count() != 1 {
			t.Errorf("cache.count() = %d, want 1", cache.count())
		}
	})

	t.Run("rejects zero NORAD id", func(t *testing.T) {
		cache := &tleCache{records: make(map[string]gpRecord)}
		rec := validRecord()
		rec.NoradCatID = 0
		data, _ := json.Marshal(rec)

		if ingestTLE(data, cache) {
			t.Error("expected ingestTLE to reject a record with NORAD id 0")
		}
		if cache.count() != 0 {
			t.Errorf("cache.count() = %d, want 0", cache.count())
		}
	})

	t.Run("rejects invalid json", func(t *testing.T) {
		cache := &tleCache{records: make(map[string]gpRecord)}
		if ingestTLE([]byte("not json"), cache) {
			t.Error("expected ingestTLE to reject invalid json")
		}
	})
}
