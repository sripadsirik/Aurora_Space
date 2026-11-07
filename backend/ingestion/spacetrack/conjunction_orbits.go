package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/sripadsirik/aurora/shared"
)

// Query the objects in the alerts, independently of CelesTrak's preset groups.
// https://www.space-track.org/documentation#/api
func conjunctionObjectIDs(warnings []shared.ConjunctionWarning) []int {
	seen := map[int]bool{}
	for _, warning := range warnings {
		for _, id := range []int{warning.Object1.NoradID, warning.Object2.NoradID} {
			if id > 0 {
				seen[id] = true
			}
		}
	}
	ids := make([]int, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	return ids
}

// Space-Track JSON encodes numeric OMM fields as strings. Normalize only the
// known numeric fields, retaining the original identity, frame and UTC epoch.
func parseConjunctionGP(body []byte, ids []int, now time.Time) ([]shared.GPRecord, error) {
	var rows []map[string]json.RawMessage
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, err
	}
	allowed := map[int]bool{}
	for _, id := range ids {
		allowed[id] = true
	}
	required := []string{"NORAD_CAT_ID", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY", "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT", "EPHEMERIS_TYPE"}
	optional := []string{"ELEMENT_SET_NO", "PERIOD", "APOAPSIS", "PERIAPSIS", "SEMIMAJOR_AXIS"}
	newest := map[int]shared.GPRecord{}
	for _, fields := range rows {
		valid := true
		for _, key := range required {
			if raw, ok := fields[key]; !ok || string(raw) == "null" {
				valid = false
			}
		}
		for _, key := range append(append([]string{}, required...), optional...) {
			raw, ok := fields[key]
			if !ok || string(raw) == "null" {
				continue
			}
			var text string
			if json.Unmarshal(raw, &text) == nil {
				value, err := strconv.ParseFloat(text, 64)
				if err != nil {
					valid = false
					break
				}
				encoded, err := json.Marshal(value)
				if err != nil {
					valid = false
					break
				}
				fields[key] = encoded
			}
		}
		var decay string
		_ = json.Unmarshal(fields["DECAY_DATE"], &decay)
		if !valid || decay != "" {
			continue
		}
		normalized, err := json.Marshal(fields)
		if err != nil {
			continue
		}
		var record shared.GPRecord
		if json.Unmarshal(normalized, &record) != nil || !allowed[record.NoradCatID] || record.ValidateOMM() != nil {
			continue
		}
		epoch, _ := record.OMMEpoch()
		if epoch.After(now.Add(24*time.Hour)) || now.Sub(epoch) > 14*24*time.Hour {
			continue
		}
		previous, exists := newest[record.NoradCatID]
		previousEpoch, _ := previous.OMMEpoch()
		if !exists || epoch.After(previousEpoch) {
			newest[record.NoradCatID] = record
		}
	}
	records := make([]shared.GPRecord, 0, len(newest))
	for _, id := range ids {
		if record, ok := newest[id]; ok {
			records = append(records, record)
		}
	}
	return records, nil
}

type conjunctionGPCache struct {
	Key       string            `json:"key"`
	FetchedAt time.Time         `json:"fetchedAt"`
	Records   []shared.GPRecord `json:"records"`
}

func loadConjunctionOrbits(ctx context.Context, warnings []shared.ConjunctionWarning, fetch func(context.Context, string) ([]byte, error), cachePath string, now time.Time) ([]shared.GPRecord, error) {
	ids := conjunctionObjectIDs(warnings)
	if len(ids) == 0 {
		return nil, nil
	}
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = strconv.Itoa(id)
	}
	key := strings.Join(parts, ",")
	var cache conjunctionGPCache
	if data, err := os.ReadFile(cachePath); err == nil && json.Unmarshal(data, &cache) == nil && cache.Key == key && !cache.FetchedAt.After(now) && now.Sub(cache.FetchedAt) < 8*time.Hour {
		body, err := json.Marshal(cache.Records)
		if err == nil {
			return parseConjunctionGP(body, ids, now)
		}
	}
	records := []shared.GPRecord{}
	for start := 0; start < len(ids); start += 100 {
		end := start + 100
		if end > len(ids) {
			end = len(ids)
		}
		url := "https://www.space-track.org/basicspacedata/query/class/gp/NORAD_CAT_ID/" + strings.Join(parts[start:end], ",") + "/format/json"
		body, err := fetch(ctx, url)
		if err != nil {
			return records, fmt.Errorf("conjunction orbit lookup: %w", err)
		}
		batch, err := parseConjunctionGP(body, ids[start:end], now)
		if err != nil {
			return records, fmt.Errorf("conjunction orbit response: %w", err)
		}
		records = append(records, batch...)
	}
	cache = conjunctionGPCache{Key: key, FetchedAt: now, Records: records}
	if data, err := json.Marshal(cache); err == nil {
		if err := os.MkdirAll(filepath.Dir(cachePath), 0700); err == nil {
			if err := os.WriteFile(cachePath+".tmp", data, 0600); err == nil {
				_ = os.Rename(cachePath+".tmp", cachePath)
			}
		}
	}
	return records, nil
}

func publishConjunctionOrbits(ctx context.Context, warnings []shared.ConjunctionWarning, sess *session, producer *shared.Producer, cachePath string) error {
	records, lookupErr := loadConjunctionOrbits(ctx, warnings, sess.fetch, cachePath, time.Now().UTC())
	batch := make([]shared.Record, 0, len(records))
	for _, record := range records {
		data, err := json.Marshal(record)
		if err != nil {
			return err
		}
		batch = append(batch, shared.Record{Key: strconv.Itoa(record.NoradCatID), Value: data})
	}
	if len(batch) > 0 {
		if err := producer.PublishBatch(ctx, batch); err != nil {
			return err
		}
	}
	if lookupErr != nil {
		return lookupErr
	}
	if len(records) < len(conjunctionObjectIDs(warnings)) {
		return fmt.Errorf("published %d of %d conjunction objects; remaining elements unavailable", len(records), len(conjunctionObjectIDs(warnings)))
	}
	return nil
}
