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
