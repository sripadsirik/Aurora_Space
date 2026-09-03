package main

import "testing"

func TestClassifyXrayFlux(t *testing.T) {
	cases := []struct {
		name string
		flux float64
		want string
	}{
		{"zero flux", 0, "A0.0"},
		{"negative flux", -1e-5, "A0.0"},
		{"below A class", 1e-9, "A0.0"},
		{"A class", 5e-8, "A5.0"},
		{"B class", 2.4e-7, "B2.4"},
		{"C class", 2.4e-6, "C2.4"},
		{"M class", 5e-5, "M5.0"},
		{"X class", 1e-4, "X1.0"},
		{"strong X class", 4.5e-4, "X4.5"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyXrayFlux(tc.flux); got != tc.want {
				t.Errorf("classifyXrayFlux(%v) = %q, want %q", tc.flux, got, tc.want)
			}
		})
	}
}
