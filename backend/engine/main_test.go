package main

import "testing"

// Real ISS (ZARYA) two-line element set (each line is 69 characters).
const (
	issLine1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9993"
	issLine2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537"
)

func validRecord() gpRecord {
	return gpRecord{
		TLELine1:     issLine1,
		TLELine2:     issLine2,
		MeanMotion:   15.72125391,
		Eccentricity: 0.0006703,
	}
}

func TestIsTLEValid(t *testing.T) {
	if !isTLEValid(validRecord()) {
		t.Fatal("valid ISS record should be accepted")
	}

	cases := []struct {
		name   string
		mutate func(*gpRecord)
	}{
		{"short line1", func(r *gpRecord) { r.TLELine1 = "1 25544" }},
		{"short line2", func(r *gpRecord) { r.TLELine2 = "2 25544" }},
		{"line1 wrong prefix", func(r *gpRecord) { r.TLELine1 = "X" + issLine1[1:] }},
		{"line2 wrong prefix", func(r *gpRecord) { r.TLELine2 = "X" + issLine2[1:] }},
		{"eccentricity too high", func(r *gpRecord) { r.Eccentricity = 1.0 }},
		{"eccentricity negative", func(r *gpRecord) { r.Eccentricity = -0.1 }},
		{"eccentricity near parabolic", func(r *gpRecord) { r.Eccentricity = 0.95 }},
		{"zero mean motion", func(r *gpRecord) { r.MeanMotion = 0 }},
		{"negative mean motion", func(r *gpRecord) { r.MeanMotion = -1 }},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := validRecord()
			tc.mutate(&rec)
			if isTLEValid(rec) {
				t.Errorf("record with %s should be rejected", tc.name)
			}
		})
	}
}
