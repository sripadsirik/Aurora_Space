package shared

import "testing"

func TestClassifyOrbit(t *testing.T) {
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
