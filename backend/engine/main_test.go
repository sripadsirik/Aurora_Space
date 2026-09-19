package main

import "testing"

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
