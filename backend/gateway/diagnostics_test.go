package main

import (
	"testing"
	"time"
)

func TestFirstNonEmpty(t *testing.T) {
	cases := []struct {
		name   string
		values []string
		want   string
	}{
		{"no values", nil, ""},
		{"all empty", []string{"", "", ""}, ""},
		{"first value wins", []string{"a", "b"}, "a"},
		{"skips leading empties", []string{"", "", "third"}, "third"},
		{"treats whitespace-only as empty", []string{"   ", "\t", "value"}, "value"},
		{"returns the whitespace-padded value verbatim", []string{" padded "}, " padded "},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := firstNonEmpty(tc.values...); got != tc.want {
				t.Errorf("firstNonEmpty(%q) = %q, want %q", tc.values, got, tc.want)
			}
		})
	}
}

func TestMaxTime(t *testing.T) {
	earlier := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	later := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	if got := maxTime(earlier, later); !got.Equal(later) {
		t.Errorf("maxTime(earlier, later) = %v, want %v", got, later)
	}
	if got := maxTime(later, earlier); !got.Equal(later) {
		t.Errorf("maxTime(later, earlier) = %v, want %v", got, later)
	}
	if got := maxTime(later, later); !got.Equal(later) {
		t.Errorf("maxTime(equal, equal) = %v, want %v", got, later)
	}

	var zero time.Time
	if got := maxTime(zero, later); !got.Equal(later) {
		t.Errorf("maxTime(zero, later) = %v, want %v", got, later)
	}
}

func TestStatusForFreshness(t *testing.T) {
	liveWindow := 5 * time.Minute
	staleWindow := 15 * time.Minute

	cases := []struct {
		name        string
		lastUpdated time.Time
		want        string
	}{
		{"zero time is ERROR", time.Time{}, "ERROR"},
		{"fresh update is LIVE", time.Now().Add(-1 * time.Minute), "LIVE"},
		{"exactly at the live window is LIVE", time.Now().Add(-liveWindow + time.Second), "LIVE"},
		{"past live but within stale is STALE", time.Now().Add(-10 * time.Minute), "STALE"},
		{"past the stale window is ERROR", time.Now().Add(-20 * time.Minute), "ERROR"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusForFreshness(tc.lastUpdated, liveWindow, staleWindow); got != tc.want {
				t.Errorf("statusForFreshness(%v) = %q, want %q", tc.lastUpdated, got, tc.want)
			}
		})
	}
}

func TestRecordsLabel(t *testing.T) {
	cases := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"zero count has no data", 0, "tracked", "No data"},
		{"negative count has no data", -3, "tracked", "No data"},
		{"single record", 1, "alerts", "1 alerts"},
		{"many records", 1200, "positions", "1200 positions"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := recordsLabel(tc.count, tc.noun); got != tc.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tc.count, tc.noun, got, tc.want)
			}
		})
	}
}

func TestFormatEventTime(t *testing.T) {
	if got := formatEventTime(time.Time{}); got != "No activity yet" {
		t.Errorf("formatEventTime(zero) = %q, want %q", got, "No activity yet")
	}

	ts := time.Date(2026, 9, 11, 14, 5, 3, 0, time.UTC)
	want := "2026-09-11 14:05:03 UTC"
	if got := formatEventTime(ts); got != want {
		t.Errorf("formatEventTime(%v) = %q, want %q", ts, got, want)
	}

	// A non-UTC input should be normalised to UTC in the rendered label.
	loc := time.FixedZone("UTC+2", 2*60*60)
	if got := formatEventTime(ts.In(loc)); got != want {
		t.Errorf("formatEventTime(non-UTC) = %q, want %q", got, want)
	}
}
