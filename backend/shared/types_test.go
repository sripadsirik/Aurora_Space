package shared

import "testing"

func TestClassifyOrbit(t *testing.T) {
	tests := []struct {
		name       string
		altitudeKm float64
		want       string
	}{
		{"low LEO", 400, "LEO"},
		{"upper LEO boundary just below MEO", 1999, "LEO"},
		{"MEO lower boundary", 2000, "MEO"},
		{"typical MEO", 20200, "MEO"},
		{"MEO upper boundary just below GEO", 35785, "MEO"},
		{"GEO boundary", 35786, "GEO"},
		{"deep GEO", 42000, "GEO"},
		{"zero altitude", 0, "LEO"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ClassifyOrbit(tt.altitudeKm); got != tt.want {
				t.Errorf("ClassifyOrbit(%v) = %q, want %q", tt.altitudeKm, got, tt.want)
			}
		})
	}
}

func TestClassifyRisk(t *testing.T) {
	tests := []struct {
		name        string
		probability float64
		want        string
	}{
		{"far below any threshold", 0, "nominal"},
		{"just at watch threshold is still nominal", 0.000001, "nominal"},
		{"just above watch threshold", 0.0000011, "watch"},
		{"just at warning threshold is still watch", 0.0001, "watch"},
		{"just above warning threshold", 0.00011, "warning"},
		{"just at critical threshold is still warning", 0.001, "warning"},
		{"just above critical threshold", 0.0011, "critical"},
		{"certain collision", 1, "critical"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ClassifyRisk(tt.probability); got != tt.want {
				t.Errorf("ClassifyRisk(%v) = %q, want %q", tt.probability, got, tt.want)
			}
		})
	}
}

func TestDeriveStormLevel(t *testing.T) {
	tests := []struct {
		name string
		kp   float64
		want string
	}{
		{"quiet", 0, "none"},
		{"just below minor", 4.9, "none"},
		{"minor boundary", 5, "minor"},
		{"moderate boundary", 6, "moderate"},
		{"strong boundary", 7, "strong"},
		{"severe boundary", 8, "severe"},
		{"extreme boundary", 9, "extreme"},
		{"above scale stays extreme", 12, "extreme"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DeriveStormLevel(tt.kp); got != tt.want {
				t.Errorf("DeriveStormLevel(%v) = %q, want %q", tt.kp, got, tt.want)
			}
		})
	}
}
