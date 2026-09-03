package shared

import "testing"

func TestClassifyOrbit(t *testing.T) {
	cases := []struct {
		name       string
		altitudeKm float64
		want       string
	}{
		{"surface", 0, "LEO"},
		{"low LEO", 400, "LEO"},
		{"upper LEO just below boundary", 1999.9, "LEO"},
		{"MEO lower boundary", 2000, "MEO"},
		{"typical MEO", 20200, "MEO"},
		{"MEO just below GEO boundary", 35785.9, "MEO"},
		{"GEO lower boundary", 35786, "GEO"},
		{"typical GEO", 42164, "GEO"},
		{"negative altitude", -100, "LEO"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyOrbit(tc.altitudeKm); got != tc.want {
				t.Errorf("ClassifyOrbit(%v) = %q, want %q", tc.altitudeKm, got, tc.want)
			}
		})
	}
}

func TestClassifyRisk(t *testing.T) {
	cases := []struct {
		name        string
		probability float64
		want        string
	}{
		{"zero probability", 0, "nominal"},
		{"just below watch threshold", 0.000001, "nominal"},
		{"just above watch threshold", 0.0000011, "watch"},
		{"mid watch band", 0.00005, "watch"},
		{"at warning threshold", 0.0001, "watch"},
		{"just above warning threshold", 0.00011, "warning"},
		{"mid warning band", 0.0005, "warning"},
		{"at critical threshold", 0.001, "warning"},
		{"just above critical threshold", 0.0011, "critical"},
		{"very high probability", 0.5, "critical"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyRisk(tc.probability); got != tc.want {
				t.Errorf("ClassifyRisk(%v) = %q, want %q", tc.probability, got, tc.want)
			}
		})
	}
}

func TestDeriveStormLevel(t *testing.T) {
	cases := []struct {
		name string
		kp   float64
		want string
	}{
		{"calm", 0, "none"},
		{"quiet just below minor", 4.9, "none"},
		{"minor at Kp 5", 5, "minor"},
		{"minor band", 5.5, "minor"},
		{"moderate at Kp 6", 6, "moderate"},
		{"strong at Kp 7", 7, "strong"},
		{"severe at Kp 8", 8, "severe"},
		{"extreme at Kp 9", 9, "extreme"},
		{"extreme above scale", 9.5, "extreme"},
		{"negative treated as none", -1, "none"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := DeriveStormLevel(tc.kp); got != tc.want {
				t.Errorf("DeriveStormLevel(%v) = %q, want %q", tc.kp, got, tc.want)
			}
		})
	}
}
