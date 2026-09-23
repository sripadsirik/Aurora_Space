package main

import "testing"

// A well-formed two-line element set for the ISS, used across the parser tests.
const (
	issLine1PR60 = "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927"
	issLine2PR60 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537"
)

func TestParseNoradCatIDPR60(t *testing.T) {
	cases := []struct {
		name   string
		line1  string
		wantID int
		wantOK bool
	}{
		{"valid ISS line", issLine1PR60, 25544, true},
		{"too short", "1 255", 0, false},
		{"non-numeric id field", "1 ABCDEU 98067A", 0, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			id, ok := parseNoradCatID(tc.line1)
			if id != tc.wantID || ok != tc.wantOK {
				t.Errorf("parseNoradCatID(%q) = (%d, %v), want (%d, %v)",
					tc.line1, id, ok, tc.wantID, tc.wantOK)
			}
		})
	}
}

func TestParseEccentricityPR60(t *testing.T) {
	if got := parseEccentricity(issLine2PR60); got != 0.0006703 {
		t.Errorf("parseEccentricity(iss) = %v, want %v", got, 0.0006703)
	}

	if got := parseEccentricity("2 25544  51.6416"); got != 0 {
		t.Errorf("parseEccentricity(short line) = %v, want 0", got)
	}
}

func TestParseMeanMotionPR60(t *testing.T) {
	if got := parseMeanMotion(issLine2PR60); got != 15.72125391 {
		t.Errorf("parseMeanMotion(iss) = %v, want %v", got, 15.72125391)
	}

	if got := parseMeanMotion("2 25544  51.6416 247.4627 0006703"); got != 0 {
		t.Errorf("parseMeanMotion(short line) = %v, want 0", got)
	}
}

func TestParseThreeLineElementsWithNamePR60(t *testing.T) {
	body := []byte("ISS (ZARYA)\n" + issLine1PR60 + "\n" + issLine2PR60 + "\n")

	records := parseThreeLineElements(body)
	if len(records) != 1 {
		t.Fatalf("got %d records, want 1", len(records))
	}

	rec := records[0]
	if rec.ObjectName != "ISS (ZARYA)" {
		t.Errorf("ObjectName = %q, want %q", rec.ObjectName, "ISS (ZARYA)")
	}
	if rec.NoradCatID != 25544 {
		t.Errorf("NoradCatID = %d, want 25544", rec.NoradCatID)
	}
	if rec.MeanMotion != 15.72125391 {
		t.Errorf("MeanMotion = %v, want 15.72125391", rec.MeanMotion)
	}
	if rec.Eccentricity != 0.0006703 {
		t.Errorf("Eccentricity = %v, want 0.0006703", rec.Eccentricity)
	}
}

func TestParseThreeLineElementsTwoLineFormPR60(t *testing.T) {
	// A bare TLE with no leading name line still yields a record.
	body := []byte(issLine1PR60 + "\n" + issLine2PR60 + "\n")

	records := parseThreeLineElements(body)
	if len(records) != 1 {
		t.Fatalf("got %d records, want 1", len(records))
	}
	if records[0].ObjectName != "" {
		t.Errorf("ObjectName = %q, want empty", records[0].ObjectName)
	}
	if records[0].NoradCatID != 25544 {
		t.Errorf("NoradCatID = %d, want 25544", records[0].NoradCatID)
	}
}

func TestParseThreeLineElementsSkipsMalformedPR60(t *testing.T) {
	// Second element is missing its line 2, so it must be skipped while the
	// first, well-formed element is still returned.
	body := []byte("ISS (ZARYA)\n" + issLine1PR60 + "\n" + issLine2PR60 + "\nDANGLING NAME\n")

	records := parseThreeLineElements(body)
	if len(records) != 1 {
		t.Fatalf("got %d records, want 1", len(records))
	}
}

func TestParseThreeLineElementsEmptyPR60(t *testing.T) {
	records := parseThreeLineElements([]byte(""))
	if len(records) != 0 {
		t.Errorf("got %d records, want 0", len(records))
	}
}
