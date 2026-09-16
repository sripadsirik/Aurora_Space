package main

import (
	"testing"
	"time"
)

func TestFirstNonEmpty(t *testing.T) {
	tests := []struct {
		name   string
		values []string
		want   string
	}{
		{"no values", nil, ""},
		{"all empty", []string{"", "   ", "\t"}, ""},
		{"first wins", []string{"a", "b"}, "a"},
		{"skips blanks", []string{"", "  ", "third"}, "third"},
		{"preserves internal whitespace", []string{"  spaced value  "}, "  spaced value  "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := firstNonEmpty(tt.values...); got != tt.want {
				t.Errorf("firstNonEmpty(%q) = %q, want %q", tt.values, got, tt.want)
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

func TestRecordsLabel(t *testing.T) {
	tests := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"zero count", 0, "tracked", "No data"},
		{"negative count", -3, "tracked", "No data"},
		{"single record", 1, "positions", "1 positions"},
		{"many records", 1500, "alerts", "1500 alerts"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := recordsLabel(tt.count, tt.noun); got != tt.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tt.count, tt.noun, got, tt.want)
			}
		})
	}
}
