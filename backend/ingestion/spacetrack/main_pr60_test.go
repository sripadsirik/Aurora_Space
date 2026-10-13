package main

import (
	"testing"
	"time"
)

func TestParseCDMsValidPR60(t *testing.T) {
	body := []byte(`[
		{
			"CDM_ID": "c1",
			"CREATED": "2026-09-19T12:00:00Z",
 "TCA": "2026-09-20T00:00:00Z",
			"MIN_RNG": "8500",
			"PC": "0.0025",
			"SAT_1_ID": "25544",
			"SAT_1_NAME": "ISS",
			"SAT_2_ID": "40000",
			"SAT_2_NAME": "DEBRIS"
		}
	]`)

	now, _ := time.Parse(time.RFC3339, "2026-09-19T12:00:00Z")
	warnings, err := parseCurrentCDMs(body, now)
	if err != nil {
		t.Fatalf("parseCDMs returned error: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("got %d warnings, want 1", len(warnings))
	}

	w := warnings[0]
	if w.ID != "c1" {
		t.Errorf("ID = %q, want c1", w.ID)
	}
	if w.Object1.NoradID != 25544 || w.Object1.Name != "ISS" {
		t.Errorf("Object1 = %+v, want {25544 ISS}", w.Object1)
	}
	if w.Object2.NoradID != 40000 || w.Object2.Name != "DEBRIS" {
		t.Errorf("Object2 = %+v, want {40000 DEBRIS}", w.Object2)
	}
	if w.MissDistanceM != 8500 {
		t.Errorf("MissDistanceM = %v, want 8500", w.MissDistanceM)
	}
	if w.MissDistanceKm != 8.5 {
		t.Errorf("MissDistanceKm = %v, want 8.5", w.MissDistanceKm)
	}
	if w.Pc != 0.0025 || w.Probability != 0.0025 {
		t.Errorf("Pc/Probability = %v/%v, want 0.0025", w.Pc, w.Probability)
	}
	// ClassifyRisk(0.0025) > 0.001 => critical.
	if w.RiskLevel != "critical" {
		t.Errorf("RiskLevel = %q, want critical", w.RiskLevel)
	}
}

func TestParseCDMsEmptyFieldsPR60(t *testing.T) {
	// Missing numeric observations must never be fabricated as zero.
	body := []byte(`[{"CDM_ID":"c2","MIN_RNG":"","PC":"","SAT_1_ID":"","SAT_2_ID":""}]`)

	now, _ := time.Parse(time.RFC3339, "2026-09-19T12:00:00Z")
	warnings, err := parseCurrentCDMs(body, now)
	if err != nil {
		t.Fatalf("parseCDMs returned error: %v", err)
	}
	if len(warnings) != 0 {
		t.Fatalf("invalid records must not become zero-risk alerts: %+v", warnings)
	}
}

func TestParseCDMsEmptyArrayPR60(t *testing.T) {
	warnings, err := parseCDMs([]byte(`[]`))
	if err != nil {
		t.Fatalf("parseCDMs returned error: %v", err)
	}
	if len(warnings) != 0 {
		t.Errorf("got %d warnings, want 0", len(warnings))
	}
}

func TestParseCDMsInvalidJSONPR60(t *testing.T) {
	if _, err := parseCDMs([]byte(`not json`)); err == nil {
		t.Error("expected error for invalid json")
	}
}
