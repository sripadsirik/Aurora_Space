package main

import (
	"math"
	"testing"
)

func TestParseCDMs(t *testing.T) {
	body := []byte(`[
		{
			"CDM_ID": "cdm-1",
			"TCA": "2026-09-03T12:00:00.000000",
			"MIN_RNG": "1500",
			"PC": "1.23e-05",
			"SAT_1_ID": "25544",
			"SAT_1_NAME": "ISS",
			"SAT_2_ID": "48274",
			"SAT_2_NAME": "DEBRIS"
		}
	]`)

	warnings, err := parseCDMs(body)
	if err != nil {
		t.Fatalf("parseCDMs returned error: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("got %d warnings, want 1", len(warnings))
	}

	w := warnings[0]
	if w.ID != "cdm-1" {
		t.Errorf("ID = %q, want cdm-1", w.ID)
	}
	if w.Object1.NoradID != 25544 || w.Object1.Name != "ISS" {
		t.Errorf("Object1 = %+v, want {25544 ISS}", w.Object1)
	}
	if w.Object2.NoradID != 48274 || w.Object2.Name != "DEBRIS" {
		t.Errorf("Object2 = %+v, want {48274 DEBRIS}", w.Object2)
	}
	if w.MissDistanceM != 1500 || math.Abs(w.MissDistanceKm-1.5) > 1e-9 {
		t.Errorf("miss distance = %vm / %vkm, want 1500m / 1.5km", w.MissDistanceM, w.MissDistanceKm)
	}
	if math.Abs(w.Pc-1.23e-05) > 1e-12 || w.Probability != w.Pc {
		t.Errorf("Pc = %v, Probability = %v, want 1.23e-05 for both", w.Pc, w.Probability)
	}
	// Pc = 1.23e-05 lands in the "watch" band (> 1e-6, <= 1e-4).
	if w.RiskLevel != "watch" {
		t.Errorf("RiskLevel = %q, want watch", w.RiskLevel)
	}
}
