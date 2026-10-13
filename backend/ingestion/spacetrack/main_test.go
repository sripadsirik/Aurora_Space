package main

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestCurrentCDMs(t *testing.T) {
	now := time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)
	row := func(id, created, tca, a, b, pc string) string {
		return fmt.Sprintf(`{"CDM_ID":"%s","CREATED":"%s","TCA":"%s","MIN_RNG":"1500","PC":%s,"SAT_1_ID":"%s","SAT_1_NAME":"ONE","SAT_2_ID":"%s","SAT_2_NAME":"TWO"}`, id, created, tca, pc, a, b)
	}
	body := "[" + strings.Join([]string{
		row("old", "2026-10-10 12:00:00", "2026-10-12T12:00:00", "1", "2", "0.001"),
		row("new", "2026-10-11 10:00:00", "2026-10-12T12:01:00", "2", "1", `"0.0001"`),
		row("past", "2026-10-11 10:00:00", "2026-10-11T11:00:00", "3", "4", "0.1"),
		row("stale", "2026-09-11 10:00:00", "2026-10-12T12:00:00", "5", "6", "0.1"),
		row("unknown", "2026-10-11 10:00:00", "2026-10-12T12:00:00", "7", "8", "null"),
		row("future", "2026-10-11 13:00:00", "2026-10-12T12:00:00", "9", "10", "0.1"),
		row("next orbit", "2026-10-11 10:00:00", "2026-10-12T13:40:00", "1", "2", "0.01"),
	}, ",") + "]"
	warnings, err := parseCurrentCDMs([]byte(body), now)
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) != 2 {
		t.Fatalf("expected two upcoming encounters, got %+v", warnings)
	}
	w := warnings[0]
	if w.ID != "new" || w.MissDistanceM != 1500 || w.MissDistanceKm != 1.5 || w.Pc != 0.0001 || w.TCA != "2026-10-12T12:01:00Z" || w.CreatedAt != "2026-10-11T10:00:00Z" {
		t.Fatalf("incorrect latest report: %+v", w)
	}
}
func TestCDMEmptyAndInvalid(t *testing.T) {
	events, err := parseCDMs([]byte(`[]`))
	if err != nil || events == nil || len(events) != 0 {
		t.Fatal("empty successful feed must serialize as []")
	}
	if _, err := parseCDMs([]byte(`{"error":"login required"}`)); err == nil {
		t.Fatal("authentication response accepted as data")
	}
}
func TestQueryIsDateBounded(t *testing.T) {
	if strings.Contains(cdmURL, "limit/20") || !strings.Contains(cdmURL, "TCA/%3Enow") || !strings.Contains(cdmURL, "CREATED/%3Enow-3") {
		t.Fatal(cdmURL)
	}
}
