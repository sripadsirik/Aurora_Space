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
		{"negative count", -3, "satellites", "No data"},
		{"single", 1, "satellite", "1 satellite"},
		{"many", 42, "satellites", "42 satellites"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := recordsLabel(tc.count, tc.noun); got != tc.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tc.count, tc.noun, got, tc.want)
			}
		})
	}
}

func TestStatusForFreshness(t *testing.T) {
	live := 30 * time.Second
	stale := 5 * time.Minute

	cases := []struct {
		name        string
		lastUpdated time.Time
		want        string
	}{
		{"never updated", time.Time{}, "ERROR"},
		{"just now is live", time.Now(), "LIVE"},
		{"within live window", time.Now().Add(-10 * time.Second), "LIVE"},
		{"within stale window", time.Now().Add(-2 * time.Minute), "STALE"},
		{"beyond stale window", time.Now().Add(-10 * time.Minute), "ERROR"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusForFreshness(tc.lastUpdated, live, stale); got != tc.want {
				t.Errorf("statusForFreshness = %q, want %q", got, tc.want)
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
		t.Errorf("maxTime(equal) = %v, want %v", got, later)
	}
}

func TestFirstNonEmpty(t *testing.T) {
	cases := []struct {
		name   string
		values []string
		want   string
	}{
		{"first wins", []string{"a", "b"}, "a"},
		{"skips empty", []string{"", "b"}, "b"},
		{"skips whitespace-only", []string{"   ", "b"}, "b"},
		{"all empty", []string{"", "  "}, ""},
		{"no args", nil, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := firstNonEmpty(tc.values...); got != tc.want {
				t.Errorf("firstNonEmpty(%v) = %q, want %q", tc.values, got, tc.want)
			}
		})
	}
}
