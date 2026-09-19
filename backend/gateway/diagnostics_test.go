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
