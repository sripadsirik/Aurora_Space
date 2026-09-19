package main

import (
	"testing"
	"time"
)

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

func TestWeatherStateToMessage(t *testing.T) {
	state := &weatherState{
		kpIndex:          6.7,
		solarWindSpeed:   540,
		solarWindDensity: 8.2,
		bzComponent:      -12.5,
		xrayFlux:         "C2.4",
	}

	msg := state.toMessage()

	if msg.KpIndex != 6.7 {
		t.Errorf("KpIndex = %v, want 6.7", msg.KpIndex)
	}
	if msg.SolarWindSpeed != 540 {
		t.Errorf("SolarWindSpeed = %v, want 540", msg.SolarWindSpeed)
	}
	if msg.BzComponent != -12.5 {
		t.Errorf("BzComponent = %v, want -12.5", msg.BzComponent)
	}
	if msg.XrayFlux != "C2.4" {
		t.Errorf("XrayFlux = %q, want C2.4", msg.XrayFlux)
	}
	// StormLevel and AuroraKp are derived from the Kp index.
	if msg.StormLevel != "moderate" {
		t.Errorf("StormLevel = %q, want moderate (Kp 6.7)", msg.StormLevel)
	}
	if msg.AuroraKp != 6 {
		t.Errorf("AuroraKp = %v, want 6 (floor of 6.7)", msg.AuroraKp)
	}
	if _, err := time.Parse(time.RFC3339, msg.LastUpdated); err != nil {
		t.Errorf("LastUpdated %q is not RFC3339: %v", msg.LastUpdated, err)
	}
}
