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
