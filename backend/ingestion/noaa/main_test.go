package main

import "testing"

func TestClassifyXrayFlux(t *testing.T) {
	cases := []struct {
		name string
		flux float64
		want string
	}{
		{"zero flux", 0, "A0.0"},
		{"negative flux", -1e-6, "A0.0"},
		{"below A class", 1e-9, "A0.0"},
		{"A class floor", 1e-8, "A1.0"},
		{"B class", 1e-7, "B1.0"},
		{"C class", 2.4e-6, "C2.4"},
		{"M class", 5.5e-5, "M5.5"},
		{"X class floor", 1e-4, "X1.0"},
		{"strong X class", 3e-4, "X3.0"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyXrayFlux(tc.flux); got != tc.want {
				t.Errorf("classifyXrayFlux(%v) = %q, want %q", tc.flux, got, tc.want)
			}
		})
	}
}
