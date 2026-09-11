package main

import "testing"

// Real ISS (ZARYA) two-line element set, used across the TLE parsing tests.
const (
	issLine1 = "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927"
	issLine2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537"
)

func TestParseNoradCatID(t *testing.T) {
	t.Run("extracts the catalogue number from line 1", func(t *testing.T) {
		id, ok := parseNoradCatID(issLine1)
		if !ok || id != 25544 {
			t.Errorf("parseNoradCatID(issLine1) = (%d, %v), want (25544, true)", id, ok)
		}
	})

	t.Run("rejects a line that is too short", func(t *testing.T) {
		if _, ok := parseNoradCatID("1 255"); ok {
			t.Error("expected ok=false for a short line")
		}
	})

	t.Run("rejects a non-numeric catalogue field", func(t *testing.T) {
		if _, ok := parseNoradCatID("1 ABCDEU 98067A"); ok {
			t.Error("expected ok=false for a non-numeric catalogue id")
		}
	})
}
