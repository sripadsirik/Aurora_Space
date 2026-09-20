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
		{"zero count is no data", 0, "tracked", "No data"},
		{"negative count is no data", -3, "tracked", "No data"},
		{"single record", 1, "positions", "1 positions"},
		{"many records", 42, "alerts", "42 alerts"},
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
		{"whitespace counts as empty", []string{"   ", "\t"}, ""},
		{"first non-empty wins", []string{"", "first", "second"}, "first"},
		{"skips blank then returns", []string{"  ", "value"}, "value"},
		{"single value", []string{"only"}, "only"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := firstNonEmpty(tc.values...); got != tc.want {
				t.Errorf("firstNonEmpty(%v) = %q, want %q", tc.values, got, tc.want)
			}
		})
	}
}

func TestMaxTime(t *testing.T) {
	earlier := time.Date(2026, 9, 20, 10, 0, 0, 0, time.UTC)
	later := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
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

func TestFormatEventTime(t *testing.T) {
	if got := formatEventTime(time.Time{}); got != "No activity yet" {
		t.Errorf("formatEventTime(zero) = %q, want %q", got, "No activity yet")
	}

	// A non-UTC input is normalised to UTC in the formatted output.
	loc := time.FixedZone("UTC+2", 2*60*60)
	stamp := time.Date(2026, 9, 20, 14, 30, 5, 0, loc)
	want := "2026-09-20 12:30:05 UTC"
	if got := formatEventTime(stamp); got != want {
		t.Errorf("formatEventTime(%v) = %q, want %q", stamp, got, want)
	}
}
