package main

import "testing"

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
