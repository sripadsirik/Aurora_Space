package shared

import "testing"

func TestClassifyOrbit(t *testing.T) {
	cases := []struct {
		name       string
		altitudeKm float64
		want       string
	}{
		{"sea level stays LEO", 0, "LEO"},
		{"typical LEO altitude", 550, "LEO"},
		{"just below the MEO boundary", 1999.9, "LEO"},
		{"exactly at 2000km is MEO", 2000, "MEO"},
		{"mid MEO altitude", 20200, "MEO"},
		{"just below the GEO boundary", 35785.9, "MEO"},
		{"exactly at 35786km is GEO", 35786, "GEO"},
		{"geostationary altitude", 35786, "GEO"},
		{"well above GEO", 400000, "GEO"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyOrbit(tc.altitudeKm); got != tc.want {
				t.Errorf("ClassifyOrbit(%v) = %q, want %q", tc.altitudeKm, got, tc.want)
			}
		})
	}
}
