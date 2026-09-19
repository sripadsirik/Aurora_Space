package shared

import "testing"

func TestClassifyOrbit(t *testing.T) {
	cases := []struct {
		name       string
		altitudeKm float64
		want       string
	}{
		{"low LEO", 400, "LEO"},
		{"just below LEO ceiling", 1999, "LEO"},
		{"LEO/MEO boundary is MEO", 2000, "MEO"},
		{"typical MEO", 20200, "MEO"},
		{"just below GEO altitude", 35785, "MEO"},
		{"GEO altitude", 35786, "GEO"},
		{"above GEO", 40000, "GEO"},
		{"sea level", 0, "LEO"},
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
		{"zero probability is nominal", 0, "nominal"},
		{"below watch threshold", 0.000001, "nominal"},
		{"just above watch threshold", 0.0000011, "watch"},
		{"mid watch band", 0.00005, "watch"},
		{"at warning threshold is still watch", 0.0001, "watch"},
		{"just above warning threshold", 0.00011, "warning"},
		{"at critical threshold is still warning", 0.001, "warning"},
		{"just above critical threshold", 0.0011, "critical"},
		{"high probability is critical", 0.5, "critical"},
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
		{"quiet", 0, "none"},
		{"just below minor", 4.99, "none"},
		{"minor at Kp5", 5, "minor"},
		{"moderate at Kp6", 6, "moderate"},
		{"strong at Kp7", 7, "strong"},
		{"severe at Kp8", 8, "severe"},
		{"extreme at Kp9", 9, "extreme"},
		{"above scale clamps to extreme", 12, "extreme"},
		{"mid-band rounds down to minor", 5.7, "minor"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := DeriveStormLevel(tc.kp); got != tc.want {
				t.Errorf("DeriveStormLevel(%v) = %q, want %q", tc.kp, got, tc.want)
			}
		})
	}
}
