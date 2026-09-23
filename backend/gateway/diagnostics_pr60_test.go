package main

import (
	"strings"
	"testing"
	"time"
)

func TestRecordsLabelPR60(t *testing.T) {
	cases := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"zero count", 0, "satellites", "No data"},
		{"negative count", -3, "satellites", "No data"},
		{"single", 1, "satellite", "1 satellite"},
		{"many", 42, "satellites", "42 satellites"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := recordsLabel(tc.count, tc.noun); got != tc.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tc.count, tc.noun, got, tc.want)
			}
		})
	}
}

func TestStatusForFreshnessPR60(t *testing.T) {
	live := 30 * time.Second
	stale := 5 * time.Minute

	cases := []struct {
		name        string
		lastUpdated time.Time
		want        string
	}{
		{"never updated", time.Time{}, "ERROR"},
		{"just now is live", time.Now(), "LIVE"},
		{"within live window", time.Now().Add(-10 * time.Second), "LIVE"},
		{"within stale window", time.Now().Add(-2 * time.Minute), "STALE"},
		{"beyond stale window", time.Now().Add(-10 * time.Minute), "ERROR"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusForFreshness(tc.lastUpdated, live, stale); got != tc.want {
				t.Errorf("statusForFreshness = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestMaxTimePR60(t *testing.T) {
	earlier := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	later := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	if got := maxTime(earlier, later); !got.Equal(later) {
		t.Errorf("maxTime(earlier, later) = %v, want %v", got, later)
	}
	if got := maxTime(later, earlier); !got.Equal(later) {
		t.Errorf("maxTime(later, earlier) = %v, want %v", got, later)
	}
	if got := maxTime(later, later); !got.Equal(later) {
		t.Errorf("maxTime(equal) = %v, want %v", got, later)
	}
}

func TestFirstNonEmptyPR60(t *testing.T) {
	cases := []struct {
		name   string
		values []string
		want   string
	}{
		{"first wins", []string{"a", "b"}, "a"},
		{"skips empty", []string{"", "b"}, "b"},
		{"skips whitespace-only", []string{"   ", "b"}, "b"},
		{"all empty", []string{"", "  "}, ""},
		{"no args", nil, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := firstNonEmpty(tc.values...); got != tc.want {
				t.Errorf("firstNonEmpty(%v) = %q, want %q", tc.values, got, tc.want)
			}
		})
	}
}

func TestFormatEventTimePR60(t *testing.T) {
	if got := formatEventTime(time.Time{}); got != "No activity yet" {
		t.Errorf("formatEventTime(zero) = %q, want %q", got, "No activity yet")
	}

	when := time.Date(2026, 9, 19, 13, 42, 5, 0, time.UTC)
	if got := formatEventTime(when); got != "2026-09-19 13:42:05 UTC" {
		t.Errorf("formatEventTime = %q, want %q", got, "2026-09-19 13:42:05 UTC")
	}
}

func TestSummarizeLogLinePR60(t *testing.T) {
	cases := []struct {
		name string
		line string
		want string
	}{
		{
			name: "plain text passthrough",
			line: "  starting up  ",
			want: "starting up",
		},
		{
			name: "invalid json passthrough",
			line: "{not valid json",
			want: "{not valid json",
		},
		{
			name: "json with no recognized fields passthrough",
			line: `{"foo":"bar"}`,
			want: `{"foo":"bar"}`,
		},
		{
			name: "msg plus recognized top-level keys",
			line: `{"msg":"kafka publish retry","err":"timeout","topic":"aurora.satellites.tle"}`,
			want: "kafka publish retry | err=timeout | topic=aurora.satellites.tle",
		},
		{
			name: "nested fields.message and fields keys",
			line: `{"fields":{"message":"processed batch","count":128}}`,
			want: "processed batch | count=128",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := summarizeLogLine(tc.line); got != tc.want {
				t.Errorf("summarizeLogLine(%q) = %q, want %q", tc.line, got, tc.want)
			}
		})
	}
}

func TestBuildCelestrakRowPR60(t *testing.T) {
	t.Run("running with fresh feed is live", func(t *testing.T) {
		process := trackedProcessSnapshot{Running: true, LastMessage: "fetch complete"}
		feed := feedSnapshot{count: 100, lastUpdated: time.Now()}

		row := buildCelestrakRow(process, feed)
		if row.Status != "LIVE" {
			t.Errorf("Status = %q, want LIVE", row.Status)
		}
		if row.Records != "100 tracked" {
			t.Errorf("Records = %q, want %q", row.Records, "100 tracked")
		}
		if row.Detail != "fetch complete" {
			t.Errorf("Detail = %q, want %q", row.Detail, "fetch complete")
		}
	})

	t.Run("stopped with no data is error", func(t *testing.T) {
		row := buildCelestrakRow(trackedProcessSnapshot{Running: false}, feedSnapshot{})
		if row.Status != "ERROR" {
			t.Errorf("Status = %q, want ERROR", row.Status)
		}
	})

	t.Run("error detail downgrades live to stale", func(t *testing.T) {
		process := trackedProcessSnapshot{Running: true, LastError: "err=timeout"}
		feed := feedSnapshot{count: 100, lastUpdated: time.Now()}

		row := buildCelestrakRow(process, feed)
		if row.Status != "STALE" {
			t.Errorf("Status = %q, want STALE", row.Status)
		}
	})
}

func TestBuildSpaceTrackRowPR60(t *testing.T) {
	t.Run("unconfigured with no data hints at credentials", func(t *testing.T) {
		row := buildSpaceTrackRow(trackedProcessSnapshot{Running: false}, feedSnapshot{}, false)
		if row.Status != "ERROR" {
			t.Errorf("Status = %q, want ERROR", row.Status)
		}
		if !strings.Contains(row.Detail, "SPACETRACK_USERNAME") {
			t.Errorf("Detail = %q, want it to mention SPACETRACK_USERNAME", row.Detail)
		}
	})

	t.Run("configured but awaiting first fetch is stale", func(t *testing.T) {
		row := buildSpaceTrackRow(trackedProcessSnapshot{Running: true}, feedSnapshot{}, true)
		if row.Status != "STALE" {
			t.Errorf("Status = %q, want STALE", row.Status)
		}
		if strings.Contains(row.Detail, "SPACETRACK_USERNAME") {
			t.Errorf("Detail = %q, should not show credential hint when configured", row.Detail)
		}
	})
}
