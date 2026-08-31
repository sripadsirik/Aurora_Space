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
