package main

import (
	"testing"
	"time"
)

func TestFirstNonEmpty(t *testing.T) {
	tests := []struct {
		name   string
		values []string
		want   string
	}{
		{"no values", nil, ""},
		{"all empty", []string{"", "   ", "\t"}, ""},
		{"first wins", []string{"a", "b"}, "a"},
		{"skips blanks", []string{"", "  ", "third"}, "third"},
		{"preserves internal whitespace", []string{"  spaced value  "}, "  spaced value  "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := firstNonEmpty(tt.values...); got != tt.want {
				t.Errorf("firstNonEmpty(%q) = %q, want %q", tt.values, got, tt.want)
			}
		})
	}
}

func TestMaxTime(t *testing.T) {
	earlier := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	later := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	if got := maxTime(earlier, later); !got.Equal(later) {
		t.Errorf("maxTime(earlier, later) = %v, want %v", got, later)
	}
	if got := maxTime(later, earlier); !got.Equal(later) {
		t.Errorf("maxTime(later, earlier) = %v, want %v", got, later)
	}
	if got := maxTime(later, later); !got.Equal(later) {
		t.Errorf("maxTime(equal, equal) = %v, want %v", got, later)
	}

	var zero time.Time
	if got := maxTime(zero, later); !got.Equal(later) {
		t.Errorf("maxTime(zero, later) = %v, want %v", got, later)
	}
}

func TestRecordsLabel(t *testing.T) {
	tests := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"zero count", 0, "tracked", "No data"},
		{"negative count", -3, "tracked", "No data"},
		{"single record", 1, "positions", "1 positions"},
		{"many records", 1500, "alerts", "1500 alerts"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := recordsLabel(tt.count, tt.noun); got != tt.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tt.count, tt.noun, got, tt.want)
			}
		})
	}
}

func TestFormatEventTime(t *testing.T) {
	var zero time.Time
	if got := formatEventTime(zero); got != "No activity yet" {
		t.Errorf("formatEventTime(zero) = %q, want %q", got, "No activity yet")
	}

	// A non-UTC input must be rendered in UTC.
	loc := time.FixedZone("UTC+5", 5*3600)
	instant := time.Date(2026, 9, 16, 18, 30, 45, 0, loc)
	want := "2026-09-16 13:30:45 UTC"
	if got := formatEventTime(instant); got != want {
		t.Errorf("formatEventTime(%v) = %q, want %q", instant, got, want)
	}
}

func TestStatusForFreshness(t *testing.T) {
	live := 2 * time.Minute
	stale := 10 * time.Minute

	var zero time.Time
	if got := statusForFreshness(zero, live, stale); got != "ERROR" {
		t.Errorf("statusForFreshness(zero) = %q, want ERROR", got)
	}

	tests := []struct {
		name string
		age  time.Duration
		want string
	}{
		{"just now is live", 1 * time.Second, "LIVE"},
		{"within live window", 90 * time.Second, "LIVE"},
		{"past live but within stale", 5 * time.Minute, "STALE"},
		{"past stale window", 30 * time.Minute, "ERROR"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lastUpdated := time.Now().Add(-tt.age)
			if got := statusForFreshness(lastUpdated, live, stale); got != tt.want {
				t.Errorf("statusForFreshness(age=%v) = %q, want %q", tt.age, got, tt.want)
			}
		})
	}
}

func TestSummarizeLogLine(t *testing.T) {
	tests := []struct {
		name string
		line string
		want string
	}{
		{
			name: "plain text passes through trimmed",
			line: "  starting celestrak ingestion  ",
			want: "starting celestrak ingestion",
		},
		{
			name: "invalid json falls back to trimmed text",
			line: "{not valid json",
			want: "{not valid json",
		},
		{
			name: "extracts msg field",
			line: `{"msg":"fetched TLEs"}`,
			want: "fetched TLEs",
		},
		{
			name: "extracts nested fields.message",
			line: `{"fields":{"message":"engine tick"}}`,
			want: "engine tick",
		},
		{
			name: "appends recognized top-level keys",
			line: `{"msg":"broadcast","count":42,"topic":"aurora.satellites.positions"}`,
			want: "broadcast | topic=aurora.satellites.positions | count=42",
		},
		{
			name: "reads recognized keys from fields when absent at top level",
			line: `{"msg":"update","fields":{"status":"ok"}}`,
			want: "update | status=ok",
		},
		{
			name: "json without recognized content returns trimmed",
			line: `{"unrelated":"value"}`,
			want: `{"unrelated":"value"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := summarizeLogLine(tt.line); got != tt.want {
				t.Errorf("summarizeLogLine(%q) = %q, want %q", tt.line, got, tt.want)
			}
		})
	}
}

func TestBuildCelestrakRow(t *testing.T) {
	now := time.Now()

	t.Run("running with fresh feed is live", func(t *testing.T) {
		row := buildCelestrakRow(
			trackedProcessSnapshot{Running: true, LastMessage: "fetched TLEs"},
			feedSnapshot{count: 1200, lastUpdated: now},
		)
		if row.Key != "celestrak" {
			t.Errorf("Key = %q, want celestrak", row.Key)
		}
		if row.Status != "LIVE" {
			t.Errorf("Status = %q, want LIVE", row.Status)
		}
		if row.Records != "1200 tracked" {
			t.Errorf("Records = %q, want %q", row.Records, "1200 tracked")
		}
		if row.Detail != "fetched TLEs" {
			t.Errorf("Detail = %q, want %q", row.Detail, "fetched TLEs")
		}
	})

	t.Run("stopped with no data is error", func(t *testing.T) {
		row := buildCelestrakRow(trackedProcessSnapshot{Running: false}, feedSnapshot{})
		if row.Status != "ERROR" {
			t.Errorf("Status = %q, want ERROR", row.Status)
		}
	})

	t.Run("live status downgrades to stale on error detail", func(t *testing.T) {
		row := buildCelestrakRow(
			trackedProcessSnapshot{Running: true, LastError: "fetch failed: timeout"},
			feedSnapshot{count: 10, lastUpdated: now},
		)
		if row.Status != "STALE" {
			t.Errorf("Status = %q, want STALE", row.Status)
		}
	})
}

func TestBuildEngineRow(t *testing.T) {
	now := time.Now()

	t.Run("fresh feed is live", func(t *testing.T) {
		row := buildEngineRow(
			trackedProcessSnapshot{Running: true},
			feedSnapshot{count: 800, lastUpdated: now},
		)
		if row.Key != "engine-rust" {
			t.Errorf("Key = %q, want engine-rust", row.Key)
		}
		if row.Status != "LIVE" {
			t.Errorf("Status = %q, want LIVE", row.Status)
		}
		if row.Records != "800 positions" {
			t.Errorf("Records = %q, want %q", row.Records, "800 positions")
		}
	})

	t.Run("running but stale feed reports stale not error", func(t *testing.T) {
		row := buildEngineRow(trackedProcessSnapshot{Running: true}, feedSnapshot{})
		if row.Status != "STALE" {
			t.Errorf("Status = %q, want STALE", row.Status)
		}
	})

	t.Run("stopped with no data is error", func(t *testing.T) {
		row := buildEngineRow(trackedProcessSnapshot{Running: false}, feedSnapshot{})
		if row.Status != "ERROR" {
			t.Errorf("Status = %q, want ERROR", row.Status)
		}
	})

	t.Run("uses default detail when process is silent", func(t *testing.T) {
		row := buildEngineRow(trackedProcessSnapshot{Running: true}, feedSnapshot{lastUpdated: now})
		if row.Detail != "Waiting for initial satellite positions" {
			t.Errorf("Detail = %q, want default placeholder", row.Detail)
		}
	})
}

func TestBuildSpaceTrackRow(t *testing.T) {
	now := time.Now()

	t.Run("fresh feed is live with alerts label", func(t *testing.T) {
		row := buildSpaceTrackRow(
			trackedProcessSnapshot{Running: true, LastMessage: "fetched CDMs"},
			feedSnapshot{count: 5, lastUpdated: now},
			true,
		)
		if row.Key != "spacetrack" {
			t.Errorf("Key = %q, want spacetrack", row.Key)
		}
		if row.Status != "LIVE" {
			t.Errorf("Status = %q, want LIVE", row.Status)
		}
		if row.Records != "5 alerts" {
			t.Errorf("Records = %q, want %q", row.Records, "5 alerts")
		}
	})

	t.Run("running without data yet is stale", func(t *testing.T) {
		row := buildSpaceTrackRow(trackedProcessSnapshot{Running: true}, feedSnapshot{}, true)
		if row.Status != "STALE" {
			t.Errorf("Status = %q, want STALE", row.Status)
		}
	})

	t.Run("stopped without data is error", func(t *testing.T) {
		row := buildSpaceTrackRow(trackedProcessSnapshot{Running: false}, feedSnapshot{}, true)
		if row.Status != "ERROR" {
			t.Errorf("Status = %q, want ERROR", row.Status)
		}
	})

	t.Run("unconfigured with no messages explains missing credentials", func(t *testing.T) {
		row := buildSpaceTrackRow(trackedProcessSnapshot{Running: true}, feedSnapshot{lastUpdated: now}, false)
		if row.Detail != "Set SPACETRACK_USERNAME and SPACETRACK_PASSWORD in backend/.env." {
			t.Errorf("Detail = %q, want credentials hint", row.Detail)
		}
	})

	t.Run("configured with no messages uses waiting detail", func(t *testing.T) {
		row := buildSpaceTrackRow(trackedProcessSnapshot{Running: true}, feedSnapshot{lastUpdated: now}, true)
		if row.Detail != "Conjunction ingestion waiting for the next fetch window" {
			t.Errorf("Detail = %q, want waiting detail", row.Detail)
		}
	})
}
