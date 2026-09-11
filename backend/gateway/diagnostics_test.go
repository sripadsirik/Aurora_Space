package main

import "testing"

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
