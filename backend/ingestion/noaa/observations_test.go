package main

import (
	"testing"
	"time"
)

func TestLatestWindUsesActiveValidSourceRegardlessOfOrder(t *testing.T) {
	body := []byte(`[
	 {"time_tag":"2026-10-11T00:30:00","active":true,"overall_quality":0,"proton_speed":670.2,"proton_density":6.22,"bz_gsm":0},
	 {"time_tag":"2026-10-11T00:32:00","active":false,"overall_quality":0,"proton_speed":999,"proton_density":6.22,"bz_gsm":20},
	 {"time_tag":"2026-10-11T00:33:00","active":true,"overall_quality":1,"proton_speed":999,"proton_density":6.22,"bz_gsm":20},
	 {"time_tag":"2026-10-11T00:34:00","active":true,"overall_quality":0,"proton_speed":null,"proton_density":6.22,"bz_gsm":null},
	 {"time_tag":"2026-10-10T00:30:00","active":true,"overall_quality":0,"proton_speed":300,"proton_density":3,"bz_gsm":-10}
	]`)
	wind, at, err := latestWindObservation(body, false)
	if err != nil || *wind.Speed != 670.2 || at.Day() != 11 {
		t.Fatalf("wrong wind observation: %+v %v", wind, err)
	}
	mag, _, err := latestWindObservation(body, true)
	if err != nil || *mag.Bz != 0 {
		t.Fatalf("valid zero Bz must be retained: %+v %v", mag, err)
	}
	if _, _, err := latestWindObservation([]byte(`[{"active":true,"overall_quality":0,"proton_speed":-9999}]`), false); err == nil {
		t.Fatal("accepted invalid reading")
	}
}

func TestKpAcceptsCurrentAndLegacyFormats(t *testing.T) {
	for _, body := range []string{
		`[{"time_tag":"2026-10-11T00:00:00","Kp":0},{"time_tag":"2026-10-10T21:00:00","Kp":5.33},{"time_tag":"2026-10-11T03:00:00","Kp":null}]`,
		`[["time_tag","Kp"],["2026-10-10 21:00:00.000","5.33"],["2026-10-11 00:00:00.000","0"]]`,
	} {
		kp, at, err := latestKpObservation([]byte(body))
		if err != nil || kp != 0 || at.Day() != 11 {
			t.Fatalf("wrong Kp: %v %v %v", kp, at, err)
		}
	}
}

func TestWeatherRequiresAllRecentObservations(t *testing.T) {
	now := time.Now()
	s := &weatherState{}
	if s.ready(now) {
		t.Fatal("uninitialized weather must not be live")
	}
	for _, key := range []string{"kp", "wind", "bz", "xray"} {
		s.markObserved(key, now)
	}
	s.markObserved("kp", now.Add(-3*time.Hour))
	if !s.ready(now) {
		t.Fatal("a complete current snapshot should publish")
	}
	s.markObserved("wind", now.Add(-16*time.Minute))
	if s.ready(now) {
		t.Fatal("new X-rays must not freshen stale wind")
	}
}
