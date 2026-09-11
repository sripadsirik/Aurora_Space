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

func TestParseEccentricity(t *testing.T) {
	t.Run("reads the assumed-leading-decimal eccentricity", func(t *testing.T) {
		got := parseEccentricity(issLine2)
		if got != 0.0006703 {
			t.Errorf("parseEccentricity(issLine2) = %v, want 0.0006703", got)
		}
	})

	t.Run("returns zero for a line too short to hold the field", func(t *testing.T) {
		if got := parseEccentricity("2 25544"); got != 0 {
			t.Errorf("parseEccentricity(short) = %v, want 0", got)
		}
	})
}

func TestParseMeanMotion(t *testing.T) {
	t.Run("reads revolutions per day", func(t *testing.T) {
		got := parseMeanMotion(issLine2)
		if got != 15.72125391 {
			t.Errorf("parseMeanMotion(issLine2) = %v, want 15.72125391", got)
		}
	})

	t.Run("returns zero for a line too short to hold the field", func(t *testing.T) {
		if got := parseMeanMotion("2 25544  51.6416"); got != 0 {
			t.Errorf("parseMeanMotion(short) = %v, want 0", got)
		}
	})
}

func TestParseThreeLineElements(t *testing.T) {
	t.Run("parses a named three-line block", func(t *testing.T) {
		body := []byte("ISS (ZARYA)\n" + issLine1 + "\n" + issLine2 + "\n")
		records := parseThreeLineElements(body)
		if len(records) != 1 {
			t.Fatalf("expected 1 record, got %d", len(records))
		}
		rec := records[0]
		if rec.ObjectName != "ISS (ZARYA)" || rec.NoradCatID != 25544 {
			t.Errorf("unexpected name/id: %q / %d", rec.ObjectName, rec.NoradCatID)
		}
		if rec.MeanMotion != 15.72125391 || rec.Eccentricity != 0.0006703 {
			t.Errorf("unexpected orbit fields: mm=%v ecc=%v", rec.MeanMotion, rec.Eccentricity)
		}
		if rec.TLELine1 != issLine1 || rec.TLELine2 != issLine2 {
			t.Error("raw TLE lines were not preserved")
		}
	})

	t.Run("parses a bare two-line block with no name", func(t *testing.T) {
		body := []byte(issLine1 + "\n" + issLine2 + "\n")
		records := parseThreeLineElements(body)
		if len(records) != 1 {
			t.Fatalf("expected 1 record, got %d", len(records))
		}
		if records[0].ObjectName != "" || records[0].NoradCatID != 25544 {
			t.Errorf("unexpected name/id: %q / %d", records[0].ObjectName, records[0].NoradCatID)
		}
	})

	t.Run("ignores trailing lines that cannot form a full record", func(t *testing.T) {
		// A well-formed block followed by a stray trailing line must not send the
		// position-based scanner into an infinite loop; the trailing line is simply
		// dropped once fewer than a full block remains.
		body := []byte("ISS (ZARYA)\n" + issLine1 + "\n" + issLine2 + "\ndangling trailing line\n")
		records := parseThreeLineElements(body)
		if len(records) != 1 {
			t.Fatalf("expected 1 record, got %d", len(records))
		}
	})

	t.Run("returns an empty slice for empty input", func(t *testing.T) {
		records := parseThreeLineElements([]byte(""))
		if records == nil || len(records) != 0 {
			t.Errorf("expected a non-nil empty slice, got %#v", records)
		}
	})
}
