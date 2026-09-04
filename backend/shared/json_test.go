package shared

import (
	"encoding/json"
	"testing"
)

// TestSatelliteJSONTags guards the wire contract shared with the frontend
// (frontend/src/types/space.ts). Renaming a JSON tag here would silently break
// the client, so the field names are asserted explicitly.
func TestSatelliteJSONTags(t *testing.T) {
	sat := Satellite{
		NoradID:          25544,
		Name:             "ISS (ZARYA)",
		Lat:              45.1,
		Lon:              -12.3,
		AltitudeKm:       420,
		VelocityKms:      7.66,
		OrbitType:        "LEO",
		RiskLevel:        "nominal",
		Owner:            "NASA",
		ConjunctionCount: 2,
	}

	raw, err := json.Marshal(sat)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	wantKeys := []string{
		"noradId", "name", "lat", "lon", "altitudeKm", "velocityKms",
		"orbitType", "riskLevel", "owner", "conjunctionCount",
	}
	for _, key := range wantKeys {
		if _, ok := decoded[key]; !ok {
			t.Errorf("marshalled Satellite missing key %q; got %s", key, raw)
		}
	}
}
