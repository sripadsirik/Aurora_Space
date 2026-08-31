package shared

import (
	"encoding/json"
	"testing"
)

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

func TestClassifyRisk(t *testing.T) {
	cases := []struct {
		name        string
		probability float64
		want        string
	}{
		{"zero probability", 0, "nominal"},
		{"just below watch threshold", 0.000001, "nominal"},
		{"just above watch threshold", 0.0000011, "watch"},
		{"watch band", 0.00005, "watch"},
		{"warning boundary is exclusive", 0.0001, "watch"},
		{"just above warning threshold", 0.00011, "warning"},
		{"warning band", 0.0005, "warning"},
		{"critical boundary is exclusive", 0.001, "warning"},
		{"just above critical threshold", 0.0011, "critical"},
		{"very high probability", 0.5, "critical"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyRisk(tc.probability); got != tc.want {
				t.Errorf("ClassifyRisk(%v) = %q, want %q", tc.probability, got, tc.want)
			}
		})
	}
}

func TestDeriveStormLevel(t *testing.T) {
	cases := []struct {
		name string
		kp   float64
		want string
	}{
		{"quiet", 0, "none"},
		{"below minor", 4.9, "none"},
		{"minor boundary", 5, "minor"},
		{"minor band", 5.5, "minor"},
		{"moderate boundary", 6, "moderate"},
		{"strong boundary", 7, "strong"},
		{"severe boundary", 8, "severe"},
		{"extreme boundary", 9, "extreme"},
		{"above scale stays extreme", 12, "extreme"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := DeriveStormLevel(tc.kp); got != tc.want {
				t.Errorf("DeriveStormLevel(%v) = %q, want %q", tc.kp, got, tc.want)
			}
		})
	}
}

func TestSatelliteJSONTags(t *testing.T) {
	sat := Satellite{
		NoradID:          25544,
		Name:             "ISS",
		Lat:              12.5,
		Lon:              -34.2,
		AltitudeKm:       420,
		VelocityKms:      7.66,
		OrbitType:        "LEO",
		RiskLevel:        "nominal",
		Owner:            "NASA",
		ConjunctionCount: 3,
	}

	data, err := json.Marshal(sat)
	if err != nil {
		t.Fatalf("marshal Satellite: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal Satellite: %v", err)
	}

	wantKeys := []string{
		"noradId", "name", "lat", "lon", "altitudeKm", "velocityKms",
		"orbitType", "riskLevel", "owner", "conjunctionCount",
	}
	for _, key := range wantKeys {
		if _, ok := decoded[key]; !ok {
			t.Errorf("Satellite JSON missing camelCase key %q; got keys %v", key, keysOf(decoded))
		}
	}
}

func TestSpaceWeatherJSONTags(t *testing.T) {
	weather := SpaceWeather{
		KpIndex:          6.3,
		SolarWindSpeed:   540,
		SolarWindDensity: 4.2,
		BzComponent:      -8.1,
		XrayFlux:         "C2.4",
		StormLevel:       "moderate",
		AuroraKp:         6,
		LastUpdated:      "2026-08-31T00:00:00Z",
	}

	data, err := json.Marshal(weather)
	if err != nil {
		t.Fatalf("marshal SpaceWeather: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal SpaceWeather: %v", err)
	}

	wantKeys := []string{
		"kpIndex", "solarWindSpeed", "solarWindDensity", "bzComponent",
		"xrayFlux", "stormLevel", "auroraKp", "lastUpdated",
	}
	for _, key := range wantKeys {
		if _, ok := decoded[key]; !ok {
			t.Errorf("SpaceWeather JSON missing camelCase key %q; got keys %v", key, keysOf(decoded))
		}
	}
}

func keysOf(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	return keys
}
