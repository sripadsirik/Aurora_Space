package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"time"
)

// SWPC's RTSW feeds are newest-first and contain several spacecraft. Only the
// active, quality-approved source is the operational solar-wind observation.
type windObservation struct {
	TimeTag string   `json:"time_tag"`
	Active  bool     `json:"active"`
	Quality *int     `json:"overall_quality"`
	Speed   *float64 `json:"proton_speed"`
	Density *float64 `json:"proton_density"`
	Bz      *float64 `json:"bz_gsm"`
}

func observationTime(value string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02 15:04:05.000"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid observation timestamp")
}

func finite(value *float64) bool {
	return value != nil && !math.IsNaN(*value) && !math.IsInf(*value, 0)
}

func latestWindObservation(body []byte, magnetic bool) (windObservation, time.Time, error) {
	var records []windObservation
	if err := json.Unmarshal(body, &records); err != nil {
		return windObservation{}, time.Time{}, err
	}
	var newest windObservation
	var newestTime time.Time
	for _, record := range records {
		if !record.Active || record.Quality == nil || *record.Quality != 0 {
			continue
		}
		if magnetic {
			if !finite(record.Bz) || math.Abs(*record.Bz) > 1000 {
				continue
			}
		} else if !finite(record.Speed) || !finite(record.Density) || *record.Speed <= 0 || *record.Density < 0 {
			continue
		}
		at, err := observationTime(record.TimeTag)
		if err == nil && at.After(newestTime) {
			newest, newestTime = record, at
		}
	}
	if newestTime.IsZero() {
		return newest, newestTime, fmt.Errorf("no valid active RTSW observation")
	}
	return newest, newestTime, nil
}

func latestKpObservation(body []byte) (float64, time.Time, error) {
	var records []struct {
		TimeTag string   `json:"time_tag"`
		Kp      *float64 `json:"Kp"`
	}
	if err := json.Unmarshal(body, &records); err != nil {
		// Keep compatibility with the previous header-and-rows feed format.
		var table [][]string
		if err := json.Unmarshal(body, &table); err != nil {
			return 0, time.Time{}, err
		}
		for _, row := range table {
			if len(row) < 2 {
				continue
			}
			kp, err := strconv.ParseFloat(row[1], 64)
			if err == nil {
				records = append(records, struct {
					TimeTag string   `json:"time_tag"`
					Kp      *float64 `json:"Kp"`
				}{row[0], &kp})
			}
		}
	}
	var kp float64
	var newest time.Time
	for _, record := range records {
		at, err := observationTime(record.TimeTag)
		if err == nil && finite(record.Kp) && *record.Kp >= 0 && *record.Kp <= 9 && at.After(newest) {
			kp, newest = *record.Kp, at
		}
	}
	if newest.IsZero() {
		return 0, newest, fmt.Errorf("no valid Kp observation")
	}
	return kp, newest, nil
}

// Called with the state mutex held. Never advertise uninitialized zeros as live
// weather, or keep old wind readings fresh just because X-ray data still arrives.
func (s *weatherState) ready(now time.Time) bool {
	for _, key := range []string{"kp", "wind", "bz", "xray"} {
		at := s.observed[key]
		maxAge := 15 * time.Minute
		if key == "kp" {
			maxAge = 6 * time.Hour
		}
		if at.IsZero() || now.Sub(at) > maxAge || at.After(now.Add(5*time.Minute)) {
			return false
		}
	}
	return true
}

func (s *weatherState) markObserved(key string, at time.Time) {
	if s.observed == nil {
		s.observed = make(map[string]time.Time)
	}
	s.observed[key] = at
	s.dirty = true
}
