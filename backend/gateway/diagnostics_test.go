package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRecordsLabel(t *testing.T) {
	cases := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"zero count is no data", 0, "tracked", "No data"},
		{"negative count is no data", -3, "tracked", "No data"},
		{"single record", 1, "positions", "1 positions"},
		{"many records", 42, "alerts", "42 alerts"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := recordsLabel(tc.count, tc.noun); got != tc.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tc.count, tc.noun, got, tc.want)
			}
		})
	}
}

func TestFirstNonEmpty(t *testing.T) {
	cases := []struct {
		name   string
		values []string
		want   string
	}{
		{"no values", nil, ""},
		{"all empty", []string{"", "", ""}, ""},
		{"whitespace counts as empty", []string{"   ", "\t"}, ""},
		{"first non-empty wins", []string{"", "first", "second"}, "first"},
		{"skips blank then returns", []string{"  ", "value"}, "value"},
		{"single value", []string{"only"}, "only"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := firstNonEmpty(tc.values...); got != tc.want {
				t.Errorf("firstNonEmpty(%v) = %q, want %q", tc.values, got, tc.want)
			}
		})
	}
}

func TestMaxTime(t *testing.T) {
	earlier := time.Date(2026, 9, 20, 10, 0, 0, 0, time.UTC)
	later := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
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

func TestFormatEventTime(t *testing.T) {
	if got := formatEventTime(time.Time{}); got != "No activity yet" {
		t.Errorf("formatEventTime(zero) = %q, want %q", got, "No activity yet")
	}

	// A non-UTC input is normalised to UTC in the formatted output.
	loc := time.FixedZone("UTC+2", 2*60*60)
	stamp := time.Date(2026, 9, 20, 14, 30, 5, 0, loc)
	want := "2026-09-20 12:30:05 UTC"
	if got := formatEventTime(stamp); got != want {
		t.Errorf("formatEventTime(%v) = %q, want %q", stamp, got, want)
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
		// Times sit comfortably inside each band rather than on the exact
		// window edge, since time.Since elapses a little past the anchor by
		// the time the function runs.
		{"zero time is error", time.Time{}, "ERROR"},
		{"fresh reading is live", now.Add(-1 * time.Minute), "LIVE"},
		{"within live window is live", now.Add(-4 * time.Minute), "LIVE"},
		{"past live window is stale", now.Add(-10 * time.Minute), "STALE"},
		{"within stale window is stale", now.Add(-14 * time.Minute), "STALE"},
		{"past stale window is error", now.Add(-30 * time.Minute), "ERROR"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusForFreshness(tc.lastUpdated, liveWindow, staleWindow); got != tc.want {
				t.Errorf("statusForFreshness = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestSummarizeLogLine(t *testing.T) {
	cases := []struct {
		name string
		line string
		want string
	}{
		{"plain text passes through", "starting ingestion", "starting ingestion"},
		{"trims surrounding whitespace", "  hello  ", "hello"},
		{"non-json braces are returned raw", "{not json", "{not json"},
		{"invalid json is returned raw", "{\"msg\":}", "{\"msg\":}"},
		{"extracts msg field", `{"msg":"fetched TLEs"}`, "fetched TLEs"},
		{"extracts nested fields.message", `{"fields":{"message":"nested msg"}}`, "nested msg"},
		{"appends known top-level keys", `{"msg":"done","count":12,"status":"ok"}`, "done | status=ok | count=12"},
		{"reads keys from fields object", `{"msg":"tick","fields":{"norad":25544}}`, "tick | norad=25544"},
		{"json with no known keys returns raw", `{"other":"x"}`, `{"other":"x"}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := summarizeLogLine(tc.line); got != tc.want {
				t.Errorf("summarizeLogLine(%q) = %q, want %q", tc.line, got, tc.want)
			}
		})
	}
}

func TestLoadTrackedProcessRecords(t *testing.T) {
	dir := t.TempDir()

	t.Run("missing file returns nil", func(t *testing.T) {
		if got := loadTrackedProcessRecords(filepath.Join(dir, "absent.json")); got != nil {
			t.Errorf("expected nil for missing file, got %v", got)
		}
	})

	t.Run("array of records", func(t *testing.T) {
		path := filepath.Join(dir, "array.json")
		body := `[{"Name":"celestrak","Pid":10},{"Name":"noaa","Pid":20}]`
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
		got := loadTrackedProcessRecords(path)
		if len(got) != 2 || got[0].Name != "celestrak" || got[1].Pid != 20 {
			t.Errorf("unexpected records: %+v", got)
		}
	})

	t.Run("single record object", func(t *testing.T) {
		path := filepath.Join(dir, "single.json")
		if err := os.WriteFile(path, []byte(`{"Name":"engine-rust","Pid":7}`), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
		got := loadTrackedProcessRecords(path)
		if len(got) != 1 || got[0].Name != "engine-rust" || got[0].Pid != 7 {
			t.Errorf("unexpected records: %+v", got)
		}
	})

	t.Run("single object without name returns nil", func(t *testing.T) {
		path := filepath.Join(dir, "nameless.json")
		if err := os.WriteFile(path, []byte(`{"Pid":3}`), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
		if got := loadTrackedProcessRecords(path); got != nil {
			t.Errorf("expected nil for nameless single record, got %+v", got)
		}
	})
}

func TestBuildCelestrakRow(t *testing.T) {
	recent := time.Now().Add(-time.Minute)

	t.Run("running feed is live", func(t *testing.T) {
		row := buildCelestrakRow(
			trackedProcessSnapshot{Running: true, LastMessage: "fetched 8000 TLEs"},
			feedSnapshot{count: 8000, lastUpdated: recent},
		)
		if row.Key != "celestrak" || row.Status != "LIVE" {
			t.Errorf("expected live celestrak row, got %+v", row)
		}
		if row.Records != "8000 tracked" {
			t.Errorf("records = %q, want %q", row.Records, "8000 tracked")
		}
	})

	t.Run("idle with no feed is error", func(t *testing.T) {
		row := buildCelestrakRow(trackedProcessSnapshot{Running: false}, feedSnapshot{})
		if row.Status != "ERROR" {
			t.Errorf("status = %q, want ERROR", row.Status)
		}
	})

	t.Run("error keyword in detail downgrades to stale", func(t *testing.T) {
		row := buildCelestrakRow(
			trackedProcessSnapshot{Running: true, LastError: "fetch failed: timeout"},
			feedSnapshot{count: 10, lastUpdated: recent},
		)
		if row.Status != "STALE" {
			t.Errorf("status = %q, want STALE", row.Status)
		}
	})
}
