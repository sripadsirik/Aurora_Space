package main

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/sripadsirik/aurora/shared"
)

func orbitTestRow(id int, epoch time.Time) map[string]interface{} {
	return map[string]interface{}{"CCSDS_OMM_VERS": "3.0", "OBJECT_NAME": "TEST", "NORAD_CAT_ID": fmt.Sprint(id), "EPOCH": epoch.Format("2006-01-02T15:04:05"), "MEAN_MOTION": "15.2", "ECCENTRICITY": "0.001", "INCLINATION": "51.6", "RA_OF_ASC_NODE": "12.0", "ARG_OF_PERICENTER": "30", "MEAN_ANOMALY": "20", "BSTAR": "0.0001", "MEAN_MOTION_DOT": "0", "MEAN_MOTION_DDOT": "0", "EPHEMERIS_TYPE": "0", "ELEMENT_SET_NO": "999", "REF_FRAME": "TEME", "TIME_SYSTEM": "UTC", "CENTER_NAME": "EARTH", "MEAN_ELEMENT_THEORY": "SGP4"}
}

func TestConjunctionGPValidatesObjectsIndependently(t *testing.T) {
	now := time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC)
	good := orbitTestRow(100605, now)
	missing := orbitTestRow(2, now)
	delete(missing, "MEAN_ANOMALY")
	corrupt := orbitTestRow(3, now)
	corrupt["ECCENTRICITY"] = "NaN"
	decayed := orbitTestRow(4, now)
	decayed["DECAY_DATE"] = "2026-10-26"
	stale := orbitTestRow(5, now.Add(-15*24*time.Hour))
	future := orbitTestRow(6, now.Add(2*24*time.Hour))
	wrongFrame := orbitTestRow(7, now)
	wrongFrame["REF_FRAME"] = "ITRF"
	numeric := orbitTestRow(8, now)
	numeric["NORAD_CAT_ID"] = 8
	numeric["MEAN_MOTION"] = 15.2
	unrequested := orbitTestRow(99, now)
	oldDuplicate := orbitTestRow(100605, now.Add(-time.Hour))
	body, _ := json.Marshal([]interface{}{good, missing, corrupt, decayed, stale, future, wrongFrame, numeric, unrequested, oldDuplicate})
	records, err := parseConjunctionGP(body, []int{2, 3, 4, 5, 6, 7, 8, 100605}, now)
	if err != nil || len(records) != 2 {
		t.Fatalf("wanted two supported objects, got %v %v", records, err)
	}
	if records[0].NoradCatID != 8 || records[1].NoradCatID != 100605 || records[1].Epoch != good["EPOCH"] {
		t.Fatalf("identity or newest epoch lost: %+v", records)
	}
}

func TestConjunctionGPQueriesEveryPairAndCachesAcrossRestarts(t *testing.T) {
	now := time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC)
	warnings := []shared.ConjunctionWarning{{Object1: shared.ConjunctionObjectRef{NoradID: 100605}, Object2: shared.ConjunctionObjectRef{NoradID: 730}}, {Object1: shared.ConjunctionObjectRef{NoradID: 730}, Object2: shared.ConjunctionObjectRef{NoradID: 42}}}
	calls := 0
	fetch := func(_ context.Context, url string) ([]byte, error) {
		calls++
		if !strings.Contains(url, "/NORAD_CAT_ID/42,730,100605/format/json") {
			t.Fatalf("wrong object query: %s", url)
		}
		return json.Marshal([]interface{}{orbitTestRow(42, now), orbitTestRow(730, now), orbitTestRow(100605, now)})
	}
	path := filepath.Join(t.TempDir(), "gp.json")
	for _, at := range []time.Time{now, now.Add(time.Hour)} {
		records, err := loadConjunctionOrbits(context.Background(), warnings, fetch, path, at)
		if err != nil || len(records) != 3 {
			t.Fatalf("missing orbits: %d %v", len(records), err)
		}
	}
	if calls != 1 {
		t.Fatalf("cache caused %d requests", calls)
	}
	if _, err := loadConjunctionOrbits(context.Background(), warnings, fetch, path, now.Add(8*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatalf("expired cache was not refreshed")
	}
}

func TestConjunctionGPBatchesAndDoesNotCacheFailedResponses(t *testing.T) {
	now := time.Now().UTC()
	var warnings []shared.ConjunctionWarning
	for i := 1; i <= 101; i++ {
		warnings = append(warnings, shared.ConjunctionWarning{Object1: shared.ConjunctionObjectRef{NoradID: i}})
	}
	calls := 0
	fetch := func(_ context.Context, url string) ([]byte, error) {
		calls++
		if strings.Contains(url, "/NORAD_CAT_ID/101/") {
			return nil, fmt.Errorf("temporary failure")
		}
		return json.Marshal([]interface{}{orbitTestRow(1, now)})
	}
	path := filepath.Join(t.TempDir(), "gp.json")
	for i := 0; i < 2; i++ {
		records, err := loadConjunctionOrbits(context.Background(), warnings, fetch, path, now)
		if err == nil || len(records) != 1 {
			t.Fatalf("wanted explicit failure with usable partial data: %v %v", records, err)
		}
	}
	if calls != 4 {
		t.Fatalf("failed response incorrectly cached: %d calls", calls)
	}
}
