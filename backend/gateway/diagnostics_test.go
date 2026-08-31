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
		{"first value wins", []string{"a", "b"}, "a"},
		{"skips empty strings", []string{"", "b"}, "b"},
		{"skips whitespace-only strings", []string{"   ", "\t", "value"}, "value"},
		{"all empty returns empty", []string{"", "  "}, ""},
		{"no values returns empty", nil, ""},
		{"preserves internal whitespace", []string{"", " padded "}, " padded "},
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
	earlier := time.Date(2026, 8, 30, 10, 0, 0, 0, time.UTC)
	later := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)
	zero := time.Time{}

	if got := maxTime(earlier, later); !got.Equal(later) {
		t.Errorf("maxTime(earlier, later) = %v, want %v", got, later)
	}
	if got := maxTime(later, earlier); !got.Equal(later) {
		t.Errorf("maxTime(later, earlier) = %v, want %v", got, later)
	}
	if got := maxTime(zero, earlier); !got.Equal(earlier) {
		t.Errorf("maxTime(zero, earlier) = %v, want %v", got, earlier)
	}
	if got := maxTime(later, later); !got.Equal(later) {
		t.Errorf("maxTime(equal, equal) = %v, want %v", got, later)
	}
}

func TestRecordsLabel(t *testing.T) {
	cases := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"positive count", 42, "tracked", "42 tracked"},
		{"single record", 1, "positions", "1 positions"},
		{"zero count", 0, "alerts", "No data"},
		{"negative count", -3, "records", "No data"},
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

	moment := time.Date(2026, 8, 31, 14, 5, 9, 0, time.FixedZone("PST", -8*3600))
	want := "2026-08-31 22:05:09 UTC"
	if got := formatEventTime(moment); got != want {
		t.Errorf("formatEventTime(%v) = %q, want %q", moment, got, want)
	}
}

func TestStatusForFreshness(t *testing.T) {
	liveWindow := 5 * time.Minute
	staleWindow := 15 * time.Minute
	now := time.Now()

	cases := []struct {
		name        string
		lastUpdated time.Time
		want        string
	}{
		{"never updated is error", time.Time{}, "ERROR"},
		{"recent is live", now.Add(-1 * time.Minute), "LIVE"},
		{"at live edge is live", now.Add(-4 * time.Minute), "LIVE"},
		{"past live window is stale", now.Add(-10 * time.Minute), "STALE"},
		{"past stale window is error", now.Add(-30 * time.Minute), "ERROR"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusForFreshness(tc.lastUpdated, liveWindow, staleWindow); got != tc.want {
				t.Errorf("statusForFreshness(%v) = %q, want %q", tc.lastUpdated, got, tc.want)
			}
		})
	}
}
