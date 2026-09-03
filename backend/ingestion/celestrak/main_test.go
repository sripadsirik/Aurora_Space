package main

import (
	"math"
	"testing"
)

// Real ISS (ZARYA) two-line element set, used to exercise the TLE column parsers.
const (
	issLine1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9993"
	issLine2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537"
)

func TestParseNoradCatID(t *testing.T) {
	if got, ok := parseNoradCatID(issLine1); !ok || got != 25544 {
		t.Errorf("parseNoradCatID(ISS) = (%d, %v), want (25544, true)", got, ok)
	}

	if _, ok := parseNoradCatID("1 abc"); ok {
		t.Error("parseNoradCatID on too-short line should return ok=false")
	}

	if _, ok := parseNoradCatID("1 XXXXXU"); ok {
		t.Error("parseNoradCatID with non-numeric id should return ok=false")
	}
}

func TestParseEccentricity(t *testing.T) {
	if got := parseEccentricity(issLine2); math.Abs(got-0.0006703) > 1e-9 {
		t.Errorf("parseEccentricity(ISS) = %v, want 0.0006703", got)
	}

	if got := parseEccentricity("2 25544"); got != 0 {
		t.Errorf("parseEccentricity on short line = %v, want 0", got)
	}
}

func TestParseMeanMotion(t *testing.T) {
	if got := parseMeanMotion(issLine2); math.Abs(got-15.72125391) > 1e-6 {
		t.Errorf("parseMeanMotion(ISS) = %v, want 15.72125391", got)
	}

	if got := parseMeanMotion("2 25544 too short"); got != 0 {
		t.Errorf("parseMeanMotion on short line = %v, want 0", got)
	}
}
