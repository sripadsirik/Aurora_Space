package shared

import "testing"

func TestClassifyOrbit(t *testing.T) {
	tests := []struct {
		name       string
		altitudeKm float64
		want       string
	}{
		{"surface", 0, "LEO"},
		{"typical LEO", 550, "LEO"},
		{"upper LEO", 1999.9, "LEO"},
		{"LEO/MEO boundary is MEO", 2000, "MEO"},
		{"mid MEO", 20000, "MEO"},
		{"upper MEO", 35785.9, "MEO"},
		{"GEO boundary", 35786, "GEO"},
		{"geostationary", 35786, "GEO"},
		{"beyond GEO", 400000, "GEO"},
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
		{"zero probability", 0, "nominal"},
		{"just below watch", 0.000001, "nominal"},
		{"watch threshold exceeded", 0.0000011, "watch"},
		{"mid watch", 0.00005, "watch"},
		{"warning threshold exceeded", 0.00011, "warning"},
		{"mid warning", 0.0005, "warning"},
		{"critical threshold exceeded", 0.0011, "critical"},
		{"high probability", 0.5, "critical"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ClassifyRisk(tt.probability); got != tt.want {
				t.Errorf("ClassifyRisk(%v) = %q, want %q", tt.probability, got, tt.want)
			}
		})
	}
}
