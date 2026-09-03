package main

import "testing"

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
