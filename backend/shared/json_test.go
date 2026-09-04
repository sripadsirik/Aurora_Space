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

// TestConjunctionWarningJSONTags guards the conjunction wire contract, including
// the nested object refs the frontend renders in the conjunctions panel.
func TestConjunctionWarningJSONTags(t *testing.T) {
	warning := ConjunctionWarning{
		ID:                  "conj-1",
		Object1:             ConjunctionObjectRef{NoradID: 25544, Name: "ISS"},
		Object2:             ConjunctionObjectRef{NoradID: 48274, Name: "STARLINK-1"},
		TCA:                 "2026-09-04T12:00:00Z",
		MissDistanceKm:      1.2,
		MissDistanceM:       1200,
		Pc:                  0.0003,
		Probability:         0.0003,
		RelativeVelocityKms: 14.7,
		RiskLevel:           "warning",
	}

	raw, err := json.Marshal(warning)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	wantKeys := []string{
		"id", "object1", "object2", "tca", "missDistanceKm", "missDistanceM",
		"pc", "probability", "relativeVelocityKms", "riskLevel",
	}
	for _, key := range wantKeys {
		if _, ok := decoded[key]; !ok {
			t.Errorf("marshalled ConjunctionWarning missing key %q; got %s", key, raw)
		}
	}

	obj1, ok := decoded["object1"].(map[string]any)
	if !ok {
		t.Fatalf("object1 is not an object; got %s", raw)
	}
	for _, key := range []string{"noradId", "name"} {
		if _, ok := obj1[key]; !ok {
			t.Errorf("object1 missing key %q; got %s", key, raw)
		}
	}
}
