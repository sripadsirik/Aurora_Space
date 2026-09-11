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

func TestClassifyRisk(t *testing.T) {
	cases := []struct {
		name        string
		probability float64
		want        string
	}{
		{"zero probability is nominal", 0, "nominal"},
		{"negative probability is nominal", -1, "nominal"},
		{"just at the watch floor stays nominal", 0.000001, "nominal"},
		{"just above the watch floor", 0.0000011, "watch"},
		{"mid watch band", 0.00005, "watch"},
		{"at the warning floor stays watch", 0.0001, "watch"},
		{"just above the warning floor", 0.00011, "warning"},
		{"at the critical floor stays warning", 0.001, "warning"},
		{"just above the critical floor", 0.0011, "critical"},
		{"very high probability is critical", 0.5, "critical"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyRisk(tc.probability); got != tc.want {
				t.Errorf("ClassifyRisk(%v) = %q, want %q", tc.probability, got, tc.want)
			}
		})
	}
}
