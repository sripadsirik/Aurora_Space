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
		{"skips blank", []string{"", "  ", "third"}, "third"},
		{"whitespace only is empty", []string{" \n ", "value"}, "value"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := firstNonEmpty(tt.values...); got != tt.want {
				t.Errorf("firstNonEmpty(%q) = %q, want %q", tt.values, got, tt.want)
			}
		})
	}
}
