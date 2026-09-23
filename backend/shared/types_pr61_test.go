package shared

import "testing"

func TestClassifyOrbitPR61(t *testing.T) {
	cases := []struct {
		name       string
		altitudeKm float64
		want       string
	}{
		{"surface is LEO", 0, "LEO"},
		{"low LEO", 400, "LEO"},
		{"just below LEO ceiling", 1999.9, "LEO"},
		{"LEO/MEO boundary is MEO", 2000, "MEO"},
		{"mid MEO", 20000, "MEO"},
		{"just below GEO threshold", 35785.9, "MEO"},
		{"GEO altitude", 35786, "GEO"},
		{"above GEO", 40000, "GEO"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyOrbit(tc.altitudeKm); got != tc.want {
				t.Errorf("ClassifyOrbit(%v) = %q, want %q", tc.altitudeKm, got, tc.want)
			}
		})
	}
}

func TestClassifyRiskPR61(t *testing.T) {
	cases := []struct {
		name        string
		probability float64
		want        string
	}{
		{"zero probability is nominal", 0, "nominal"},
		{"just below watch threshold", 0.000001, "nominal"},
		{"watch band", 0.00001, "watch"},
		{"just below warning threshold", 0.0001, "watch"},
		{"warning band", 0.0005, "warning"},
		{"just below critical threshold", 0.001, "warning"},
		{"critical band", 0.01, "critical"},
		{"certain collision is critical", 1, "critical"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyRisk(tc.probability); got != tc.want {
				t.Errorf("ClassifyRisk(%v) = %q, want %q", tc.probability, got, tc.want)
			}
		})
	}
}

func TestDeriveStormLevelPR61(t *testing.T) {
	cases := []struct {
		name string
		kp   float64
		want string
	}{
		{"quiet below Kp 5", 4.9, "none"},
		{"Kp 5 is minor", 5, "minor"},
		{"Kp 6 is moderate", 6, "moderate"},
		{"Kp 7 is strong", 7, "strong"},
		{"Kp 8 is severe", 8, "severe"},
		{"Kp 9 is extreme", 9, "extreme"},
		{"above Kp 9 stays extreme", 9.5, "extreme"},
		{"negative Kp is none", -1, "none"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := DeriveStormLevel(tc.kp); got != tc.want {
				t.Errorf("DeriveStormLevel(%v) = %q, want %q", tc.kp, got, tc.want)
			}
		})
	}
}
