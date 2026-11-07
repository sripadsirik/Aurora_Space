package main

import (
	"bytes"
	"encoding/json"
	"log/slog"
)

func parseGPData(body []byte) []gpRecord {
	if !bytes.HasPrefix(bytes.TrimSpace(body), []byte("[")) {
		return parseThreeLineElements(body)
	}
	var rows []json.RawMessage
	if json.Unmarshal(body, &rows) != nil {
		return nil
	}
	records := make([]gpRecord, 0, len(rows))
	for _, raw := range rows {
		var rec gpRecord
		var fields map[string]json.RawMessage
		if json.Unmarshal(raw, &rec) != nil || json.Unmarshal(raw, &fields) != nil {
			continue
		}
		complete := true
		for _, key := range []string{"EPOCH", "NORAD_CAT_ID", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY", "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT"} {
			if value, ok := fields[key]; !ok || bytes.Equal(value, []byte("null")) {
				complete = false
			}
		}
		if !complete {
			continue
		}
		if err := rec.ValidateOMM(); err != nil {
			slog.Debug("OMM rejected", "norad", rec.NoradCatID, "err", err)
			continue
		}
		records = append(records, rec)
	}
	return records
}
