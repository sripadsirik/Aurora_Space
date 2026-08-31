package main

import "testing"

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
