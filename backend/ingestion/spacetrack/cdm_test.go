package main

import "testing"

func TestParseCDMs(t *testing.T) {
	body := []byte(`[
		{
			"CDM_ID": "12345",
			"TCA": "2026-09-11T00:00:00Z",
			"MIN_RNG": "1500",
			"PC": "1.23456e-05",
			"SAT_1_ID": "25544",
			"SAT_1_NAME": "ISS (ZARYA)",
			"SAT_2_ID": "48274",
			"SAT_2_NAME": "STARLINK-2000"
		}
	]`)

	warnings, err := parseCDMs(body)
	if err != nil {
		t.Fatalf("parseCDMs returned error: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}

	w := warnings[0]
	if w.ID != "12345" {
		t.Errorf("ID = %q, want %q", w.ID, "12345")
	}
	if w.Object1.NoradID != 25544 || w.Object1.Name != "ISS (ZARYA)" {
		t.Errorf("Object1 = %+v, want 25544/ISS (ZARYA)", w.Object1)
	}
	if w.Object2.NoradID != 48274 {
		t.Errorf("Object2.NoradID = %d, want 48274", w.Object2.NoradID)
	}
	// MIN_RNG is metres; miss distance km should be metres/1000.
	if w.MissDistanceM != 1500 || w.MissDistanceKm != 1.5 {
		t.Errorf("miss distance = %vm / %vkm, want 1500m / 1.5km", w.MissDistanceM, w.MissDistanceKm)
	}
	// PC is mirrored into both Pc and Probability, and drives the risk level.
	if w.Pc != 1.23456e-05 || w.Probability != w.Pc {
		t.Errorf("pc/probability = %v/%v, want 1.23456e-05 mirrored", w.Pc, w.Probability)
	}
	if w.RiskLevel != "watch" {
		t.Errorf("RiskLevel = %q, want %q", w.RiskLevel, "watch")
	}
}

func TestParseCDMsHandlesMissingAndInvalidFields(t *testing.T) {
	// Empty MIN_RNG/PC and non-numeric ids should degrade gracefully to zeroes
	// rather than erroring out the whole batch.
	body := []byte(`[{"CDM_ID":"1","TCA":"2026-01-01T00:00:00Z","MIN_RNG":"","PC":"","SAT_1_ID":"","SAT_2_ID":"abc"}]`)

	warnings, err := parseCDMs(body)
	if err != nil {
		t.Fatalf("parseCDMs returned error: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}

	w := warnings[0]
	if w.MissDistanceM != 0 || w.MissDistanceKm != 0 || w.Pc != 0 {
		t.Errorf("expected zeroed distances/pc, got %vm %vkm pc=%v", w.MissDistanceM, w.MissDistanceKm, w.Pc)
	}
	if w.Object1.NoradID != 0 || w.Object2.NoradID != 0 {
		t.Errorf("expected zeroed norad ids, got %d/%d", w.Object1.NoradID, w.Object2.NoradID)
	}
	if w.RiskLevel != "nominal" {
		t.Errorf("RiskLevel = %q, want %q", w.RiskLevel, "nominal")
	}
}

func TestParseCDMsRejectsInvalidJSON(t *testing.T) {
	if _, err := parseCDMs([]byte(`{not an array}`)); err == nil {
		t.Error("expected an error for malformed JSON")
	}
}
