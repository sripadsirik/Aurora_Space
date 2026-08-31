package shared

import "testing"

func TestClassifyOrbit(t *testing.T) {
	cases := []struct {
		name       string
		altitudeKm float64
		want       string
	}{
		{"low orbit", 400, "LEO"},
		{"leo upper edge below 2000", 1999.9, "LEO"},
		{"meo lower boundary at 2000", 2000, "MEO"},
		{"mid orbit", 20000, "MEO"},
		{"meo upper edge below geo", 35785.9, "MEO"},
		{"geo boundary at 35786", 35786, "GEO"},
		{"high orbit", 42000, "GEO"},
		{"surface", 0, "LEO"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyOrbit(tc.altitudeKm); got != tc.want {
				t.Errorf("ClassifyOrbit(%v) = %q, want %q", tc.altitudeKm, got, tc.want)
			}
		})
	}
}
