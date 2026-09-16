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
