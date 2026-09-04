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
