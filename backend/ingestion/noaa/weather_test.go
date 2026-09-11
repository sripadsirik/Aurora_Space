package main

import "testing"

func TestClassifyXrayFlux(t *testing.T) {
	cases := []struct {
		name string
		flux float64
		want string
	}{
		{"zero flux is the quiet baseline", 0, "A0.0"},
		{"negative flux is the quiet baseline", -1e-6, "A0.0"},
		{"below the A threshold is the quiet baseline", 1e-9, "A0.0"},
		{"A class", 1e-8, "A1.0"},
		{"B class", 3e-7, "B3.0"},
		{"C class mid-band", 2.4e-6, "C2.4"},
		{"M class", 5.5e-5, "M5.5"},
		{"X class at the threshold", 1e-4, "X1.0"},
		{"large X-class flare", 1.2e-3, "X12.0"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyXrayFlux(tc.flux); got != tc.want {
				t.Errorf("classifyXrayFlux(%v) = %q, want %q", tc.flux, got, tc.want)
			}
		})
	}
}
