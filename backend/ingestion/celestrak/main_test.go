package main

import "testing"

// A well-formed two-line element set for the ISS, used across the parser tests.
const (
	issLine1 = "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927"
	issLine2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537"
)

func TestParseNoradCatID(t *testing.T) {
	cases := []struct {
		name   string
		line1  string
		wantID int
		wantOK bool
	}{
		{"valid ISS line", issLine1, 25544, true},
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
