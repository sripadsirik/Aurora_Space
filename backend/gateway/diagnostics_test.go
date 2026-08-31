package main

import (
	"strings"
	"testing"
	"time"
)

func TestFirstNonEmpty(t *testing.T) {
	cases := []struct {
		name   string
		values []string
		want   string
	}{
		{"first value wins", []string{"a", "b"}, "a"},
		{"skips empty strings", []string{"", "b"}, "b"},
		{"skips whitespace-only strings", []string{"   ", "\t", "value"}, "value"},
		{"all empty returns empty", []string{"", "  "}, ""},
		{"no values returns empty", nil, ""},
		{"preserves internal whitespace", []string{"", " padded "}, " padded "},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := firstNonEmpty(tc.values...); got != tc.want {
				t.Errorf("firstNonEmpty(%q) = %q, want %q", tc.values, got, tc.want)
			}
		})
	}
}

func TestMaxTime(t *testing.T) {
	earlier := time.Date(2026, 8, 30, 10, 0, 0, 0, time.UTC)
	later := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)
	zero := time.Time{}

	if got := maxTime(earlier, later); !got.Equal(later) {
		t.Errorf("maxTime(earlier, later) = %v, want %v", got, later)
	}
	if got := maxTime(later, earlier); !got.Equal(later) {
		t.Errorf("maxTime(later, earlier) = %v, want %v", got, later)
	}
	if got := maxTime(zero, earlier); !got.Equal(earlier) {
		t.Errorf("maxTime(zero, earlier) = %v, want %v", got, earlier)
	}
	if got := maxTime(later, later); !got.Equal(later) {
		t.Errorf("maxTime(equal, equal) = %v, want %v", got, later)
	}
}

func TestRecordsLabel(t *testing.T) {
	cases := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"positive count", 42, "tracked", "42 tracked"},
		{"single record", 1, "positions", "1 positions"},
		{"zero count", 0, "alerts", "No data"},
		{"negative count", -3, "records", "No data"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := recordsLabel(tc.count, tc.noun); got != tc.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tc.count, tc.noun, got, tc.want)
			}
		})
	}
}

func TestFormatEventTime(t *testing.T) {
	if got := formatEventTime(time.Time{}); got != "No activity yet" {
		t.Errorf("formatEventTime(zero) = %q, want %q", got, "No activity yet")
	}

	moment := time.Date(2026, 8, 31, 14, 5, 9, 0, time.FixedZone("PST", -8*3600))
	want := "2026-08-31 22:05:09 UTC"
	if got := formatEventTime(moment); got != want {
		t.Errorf("formatEventTime(%v) = %q, want %q", moment, got, want)
	}
}

func TestStatusForFreshness(t *testing.T) {
	liveWindow := 5 * time.Minute
	staleWindow := 15 * time.Minute
	now := time.Now()

	cases := []struct {
		name        string
		lastUpdated time.Time
		want        string
	}{
		{"never updated is error", time.Time{}, "ERROR"},
		{"recent is live", now.Add(-1 * time.Minute), "LIVE"},
		{"at live edge is live", now.Add(-4 * time.Minute), "LIVE"},
		{"past live window is stale", now.Add(-10 * time.Minute), "STALE"},
		{"past stale window is error", now.Add(-30 * time.Minute), "ERROR"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusForFreshness(tc.lastUpdated, liveWindow, staleWindow); got != tc.want {
				t.Errorf("statusForFreshness(%v) = %q, want %q", tc.lastUpdated, got, tc.want)
			}
		})
	}
}

func TestSummarizeLogLine(t *testing.T) {
	t.Run("plain text passes through trimmed", func(t *testing.T) {
		if got := summarizeLogLine("  hello world  "); got != "hello world" {
			t.Errorf("got %q, want %q", got, "hello world")
		}
	})

	t.Run("invalid json passes through", func(t *testing.T) {
		line := "{not valid json"
		if got := summarizeLogLine(line); got != line {
			t.Errorf("got %q, want %q", got, line)
		}
	})

	t.Run("extracts msg field", func(t *testing.T) {
		if got := summarizeLogLine(`{"msg":"ingest complete"}`); got != "ingest complete" {
			t.Errorf("got %q, want %q", got, "ingest complete")
		}
	})

	t.Run("extracts nested fields.message", func(t *testing.T) {
		if got := summarizeLogLine(`{"fields":{"message":"nested detail"}}`); got != "nested detail" {
			t.Errorf("got %q, want %q", got, "nested detail")
		}
	})

	t.Run("appends known keyed fields", func(t *testing.T) {
		got := summarizeLogLine(`{"msg":"batch","count":12,"status":200}`)
		if !strings.Contains(got, "batch") || !strings.Contains(got, "count=12") || !strings.Contains(got, "status=200") {
			t.Errorf("got %q, want it to include batch, count=12 and status=200", got)
		}
	})

	t.Run("json without known keys falls back to raw", func(t *testing.T) {
		line := `{"unknown":"value"}`
		if got := summarizeLogLine(line); got != line {
			t.Errorf("got %q, want %q", got, line)
		}
	})
}

func TestBuildCelestrakRow(t *testing.T) {
	recent := time.Now().Add(-1 * time.Minute)

	t.Run("running with fresh feed is live", func(t *testing.T) {
		process := trackedProcessSnapshot{Running: true, LastMessage: "fetched 8000 TLEs"}
		feed := feedSnapshot{count: 8000, lastUpdated: recent}
		row := buildCelestrakRow(process, feed)

		if row.Key != "celestrak" {
			t.Errorf("Key = %q, want celestrak", row.Key)
		}
		if row.Status != "LIVE" {
			t.Errorf("Status = %q, want LIVE", row.Status)
		}
		if row.Records != "8000 tracked" {
			t.Errorf("Records = %q, want %q", row.Records, "8000 tracked")
		}
	})

	t.Run("stopped with no data is error", func(t *testing.T) {
		row := buildCelestrakRow(trackedProcessSnapshot{Running: false}, feedSnapshot{})
		if row.Status != "ERROR" {
			t.Errorf("Status = %q, want ERROR", row.Status)
		}
	})

	t.Run("error in log downgrades live to stale", func(t *testing.T) {
		process := trackedProcessSnapshot{Running: true, LastError: "fetch failed: timeout"}
		feed := feedSnapshot{count: 10, lastUpdated: recent}
		row := buildCelestrakRow(process, feed)
		if row.Status != "STALE" {
			t.Errorf("Status = %q, want STALE", row.Status)
		}
	})
}
