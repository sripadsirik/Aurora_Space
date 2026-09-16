package main

import "testing"

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
