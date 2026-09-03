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

func TestParseThreeLineElements(t *testing.T) {
	body := []byte("ISS (ZARYA)\n" + issLine1 + "\n" + issLine2 + "\n" +
		"NOAA 19\n" +
		"1 33591U 09005A   24001.51000000  .00000100  00000-0  10000-3 0  9990\n" +
		"2 33591  99.1000 100.0000 0013000 200.0000 160.0000 14.12000000700000\n")

	records := parseThreeLineElements(body)
	if len(records) != 2 {
		t.Fatalf("got %d records, want 2", len(records))
	}

	if records[0].ObjectName != "ISS (ZARYA)" || records[0].NoradCatID != 25544 {
		t.Errorf("first record = %+v, want ISS 25544", records[0])
	}
	if records[0].TLELine1 != issLine1 || records[0].TLELine2 != issLine2 {
		t.Error("first record did not preserve TLE lines")
	}
	if records[1].NoradCatID != 33591 {
		t.Errorf("second record norad = %d, want 33591", records[1].NoradCatID)
	}
}

func TestParseThreeLineElementsBareTwoLine(t *testing.T) {
	// A record with no name line, starting directly with "1 ".
	body := []byte(issLine1 + "\n" + issLine2 + "\n")

	records := parseThreeLineElements(body)
	if len(records) != 1 {
		t.Fatalf("got %d records, want 1", len(records))
	}
	if records[0].ObjectName != "" {
		t.Errorf("bare record name = %q, want empty", records[0].ObjectName)
	}
	if records[0].NoradCatID != 25544 {
		t.Errorf("bare record norad = %d, want 25544", records[0].NoradCatID)
	}
}

func TestParseThreeLineElementsSkipsMalformed(t *testing.T) {
	body := []byte("GARBAGE LINE\nANOTHER GARBAGE\n")
	if records := parseThreeLineElements(body); len(records) != 0 {
		t.Errorf("got %d records from garbage, want 0", len(records))
	}
}
