package main

import (
	"os"
	"path/filepath"
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
		{"skips blank", []string{"", "  ", "third"}, "third"},
		{"whitespace only is empty", []string{" \n ", "value"}, "value"},
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
	earlier := time.Date(2026, 9, 4, 10, 0, 0, 0, time.UTC)
	later := time.Date(2026, 9, 4, 12, 0, 0, 0, time.UTC)
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
	tests := []struct {
		name  string
		count int
		noun  string
		want  string
	}{
		{"zero", 0, "tracked", "No data"},
		{"negative", -3, "tracked", "No data"},
		{"single", 1, "position", "1 position"},
		{"many", 4200, "records", "4200 records"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := recordsLabel(tt.count, tt.noun); got != tt.want {
				t.Errorf("recordsLabel(%d, %q) = %q, want %q", tt.count, tt.noun, got, tt.want)
			}
		})
	}
}

func TestStatusForFreshness(t *testing.T) {
	live := 2 * time.Minute
	stale := 10 * time.Minute
	now := time.Now()

	tests := []struct {
		name        string
		lastUpdated time.Time
		want        string
	}{
		{"zero time is error", time.Time{}, "ERROR"},
		{"fresh is live", now.Add(-30 * time.Second), "LIVE"},
		{"at live window is live", now.Add(-live + time.Second), "LIVE"},
		{"past live but within stale", now.Add(-5 * time.Minute), "STALE"},
		{"past stale window is error", now.Add(-30 * time.Minute), "ERROR"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := statusForFreshness(tt.lastUpdated, live, stale); got != tt.want {
				t.Errorf("statusForFreshness(%v) = %q, want %q", tt.lastUpdated, got, tt.want)
			}
		})
	}
}

func TestFormatEventTime(t *testing.T) {
	if got := formatEventTime(time.Time{}); got != "No activity yet" {
		t.Errorf("formatEventTime(zero) = %q, want %q", got, "No activity yet")
	}

	stamp := time.Date(2026, 9, 4, 15, 4, 5, 0, time.UTC)
	if got := formatEventTime(stamp); got != "2026-09-04 15:04:05 UTC" {
		t.Errorf("formatEventTime(stamp) = %q, want %q", got, "2026-09-04 15:04:05 UTC")
	}
}

func TestSummarizeLogLine(t *testing.T) {
	tests := []struct {
		name string
		line string
		want string
	}{
		{"plain text passes through", "starting celestrak ingest", "starting celestrak ingest"},
		{"plain text trimmed", "  padded line  ", "padded line"},
		{"invalid json passes through", "{not valid json", "{not valid json"},
		{"json message extracted", `{"msg":"published batch"}`, "published batch"},
		{"json message with fields", `{"msg":"fetch done","count":42}`, "fetch done | count=42"},
		{"nested fields message", `{"fields":{"message":"nested"}}`, "nested"},
		{"error field appended", `{"msg":"boom","err":"timeout"}`, "boom | err=timeout"},
		{"json without known keys", `{"foo":"bar"}`, `{"foo":"bar"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := summarizeLogLine(tt.line); got != tt.want {
				t.Errorf("summarizeLogLine(%q) = %q, want %q", tt.line, got, tt.want)
			}
		})
	}
}

func TestLoadTrackedProcessRecords(t *testing.T) {
	t.Run("missing file returns nil", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "processes.json")
		if got := loadTrackedProcessRecords(path); got != nil {
			t.Errorf("loadTrackedProcessRecords(missing) = %v, want nil", got)
		}
	})

	t.Run("array form", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "processes.json")
		body := `[{"Name":"celestrak","Pid":101},{"Name":"noaa","Pid":102}]`
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
		got := loadTrackedProcessRecords(path)
		if len(got) != 2 || got[0].Name != "celestrak" || got[1].Pid != 102 {
			t.Errorf("array parse mismatch: %+v", got)
		}
	})

	t.Run("single object form", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "processes.json")
		body := `{"Name":"engine-rust","Pid":200}`
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
		got := loadTrackedProcessRecords(path)
		if len(got) != 1 || got[0].Name != "engine-rust" || got[0].Pid != 200 {
			t.Errorf("single parse mismatch: %+v", got)
		}
	})

	t.Run("invalid json returns nil", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "processes.json")
		if err := os.WriteFile(path, []byte("not json"), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
		if got := loadTrackedProcessRecords(path); got != nil {
			t.Errorf("loadTrackedProcessRecords(invalid) = %v, want nil", got)
		}
	})
}
