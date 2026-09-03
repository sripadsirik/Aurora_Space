package main

import (
	"testing"
	"time"
)

func TestRecordsLabel(t *testing.T) {
	cases := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"zero count", 0, "satellites", "No data"},
		{"negative count", -5, "satellites", "No data"},
		{"single record", 1, "record", "1 record"},
		{"many records", 42, "satellites", "42 satellites"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := recordsLabel(tc.count, tc.noun); got != tc.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tc.count, tc.noun, got, tc.want)
			}
		})
	}
}

func TestFirstNonEmpty(t *testing.T) {
	cases := []struct {
		name   string
		values []string
		want   string
	}{
		{"no values", nil, ""},
		{"all empty", []string{"", "", ""}, ""},
		{"whitespace only treated as empty", []string{" ", "\t", "\n"}, ""},
		{"first value wins", []string{"first", "second"}, "first"},
		{"skips leading empties", []string{"", "  ", "third"}, "third"},
		{"preserves original spacing of chosen value", []string{"", " padded "}, " padded "},
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
	live := 30 * time.Second
	stale := 5 * time.Minute
	now := time.Now()

	cases := []struct {
		name        string
		lastUpdated time.Time
		want        string
	}{
		{"zero time is error", time.Time{}, "ERROR"},
		{"recent is live", now.Add(-5 * time.Second), "LIVE"},
		{"at live edge is live", now.Add(-live + time.Second), "LIVE"},
		{"beyond live is stale", now.Add(-2 * time.Minute), "STALE"},
		{"at stale edge is stale", now.Add(-stale + time.Second), "STALE"},
		{"beyond stale is error", now.Add(-10 * time.Minute), "ERROR"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusForFreshness(tc.lastUpdated, live, stale); got != tc.want {
				t.Errorf("statusForFreshness(%v) = %q, want %q", tc.lastUpdated, got, tc.want)
			}
		})
	}
}
