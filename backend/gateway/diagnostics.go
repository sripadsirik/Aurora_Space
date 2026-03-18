package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type diagnosticsResponse struct {
	GeneratedAt string                `json:"generatedAt"`
	Rows        []sourceDiagnosticRow `json:"rows"`
}

type sourceDiagnosticRow struct {
	Key       string `json:"key"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Status    string `json:"status"`
	LastEvent string `json:"lastEvent"`
	Records   string `json:"records"`
	Frequency string `json:"frequency"`
	Detail    string `json:"detail,omitempty"`
}

type trackedProcessRecord struct {
	Name      string `json:"Name"`
	Pid       int    `json:"Pid"`
	Log       string `json:"Log"`
	ErrorLog  string `json:"ErrorLog"`
	StartedAt string `json:"StartedAt"`
}

type trackedProcessSnapshot struct {
	Name         string
	Running      bool
	LastMessage  string
	LastError    string
	LastActivity time.Time
}

func diagnosticsHandler(cache *stateCache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		response := diagnosticsResponse{
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
			Rows:        buildDiagnosticsRows(cache),
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			http.Error(w, `{"error":"encode diagnostics failed"}`, http.StatusInternalServerError)
		}
	}
}

func buildDiagnosticsRows(cache *stateCache) []sourceDiagnosticRow {
	feeds := cache.snapshot()
	processes := loadTrackedProcessSnapshots(discoverRepoRoot())
	spaceTrackConfigured := os.Getenv("SPACETRACK_USERNAME") != "" && os.Getenv("SPACETRACK_PASSWORD") != ""

	return []sourceDiagnosticRow{
		buildCelestrakRow(processes["celestrak"], feeds.satellites),
		buildEngineRow(processes["engine-rust"], feeds.satellites),
		buildSpaceTrackRow(processes["spacetrack"], feeds.conjunctions, spaceTrackConfigured),
		buildNoaaRow(processes["noaa"], feeds.spaceWeather),
	}
}

func buildCelestrakRow(process trackedProcessSnapshot, feed feedSnapshot) sourceDiagnosticRow {
	status := "LIVE"
	if !process.Running && feed.lastUpdated.IsZero() {
		status = "ERROR"
	}

	detail := firstNonEmpty(process.LastError, process.LastMessage, "TLE ingestion process idle")
	detailLower := strings.ToLower(detail)
	if status == "LIVE" && (strings.Contains(detailLower, "error") || strings.Contains(detailLower, "failed") || strings.Contains(detailLower, "err=")) {
		status = "STALE"
	}

	return sourceDiagnosticRow{
		Key:       "celestrak",
		Name:      "CelesTrak TLE Feed",
		URL:       "https://celestrak.org",
		Status:    status,
		LastEvent: formatEventTime(maxTime(process.LastActivity, feed.lastUpdated)),
		Records:   recordsLabel(feed.count, "tracked"),
		Frequency: "2h",
		Detail:    detail,
	}
}

func buildEngineRow(process trackedProcessSnapshot, feed feedSnapshot) sourceDiagnosticRow {
	status := statusForFreshness(feed.lastUpdated, 2*time.Minute, 10*time.Minute)
	if status == "ERROR" && process.Running {
		status = "STALE"
	}
	if !process.Running && feed.lastUpdated.IsZero() {
		status = "ERROR"
	}

	detail := firstNonEmpty(
		process.LastError,
		process.LastMessage,
		"Waiting for initial satellite positions",
	)

	return sourceDiagnosticRow{
		Key:       "engine-rust",
		Name:      "Rust Propagation Engine",
		URL:       "kafka://aurora.satellites.positions",
		Status:    status,
		LastEvent: formatEventTime(maxTime(process.LastActivity, feed.lastUpdated)),
		Records:   recordsLabel(feed.count, "positions"),
		Frequency: "30s",
		Detail:    detail,
	}
}

func buildSpaceTrackRow(process trackedProcessSnapshot, feed feedSnapshot, configured bool) sourceDiagnosticRow {
	status := statusForFreshness(feed.lastUpdated, 8*time.Hour, 24*time.Hour)
	if feed.lastUpdated.IsZero() && process.Running {
		status = "STALE"
	}
	if !process.Running && feed.lastUpdated.IsZero() {
		status = "ERROR"
	}

	detail := firstNonEmpty(process.LastError, process.LastMessage)
	if detail == "" && !configured {
		detail = "Set SPACETRACK_USERNAME and SPACETRACK_PASSWORD in backend/.env."
	}
	if detail == "" {
		detail = "Conjunction ingestion waiting for the next fetch window"
	}

	return sourceDiagnosticRow{
		Key:       "spacetrack",
		Name:      "Space-Track CDMs",
		URL:       "https://space-track.org",
		Status:    status,
		LastEvent: formatEventTime(maxTime(process.LastActivity, feed.lastUpdated)),
		Records:   recordsLabel(feed.count, "alerts"),
		Frequency: "6h",
		Detail:    detail,
	}
}

func buildNoaaRow(process trackedProcessSnapshot, feed feedSnapshot) sourceDiagnosticRow {
	status := statusForFreshness(feed.lastUpdated, 5*time.Minute, 15*time.Minute)
	if status == "ERROR" && process.Running {
		status = "STALE"
	}
	if !process.Running && feed.lastUpdated.IsZero() {
		status = "ERROR"
	}

	detail := firstNonEmpty(process.LastError, process.LastMessage, "Space weather ingestion running")
	detailLower := strings.ToLower(detail)
	if status == "LIVE" && (strings.Contains(detailLower, "error") || strings.Contains(detailLower, "failed") || strings.Contains(detailLower, "err=")) {
		status = "STALE"
	}

	return sourceDiagnosticRow{
		Key:       "noaa",
		Name:      "NOAA SWPC",
		URL:       "https://swpc.noaa.gov",
		Status:    status,
		LastEvent: formatEventTime(maxTime(process.LastActivity, feed.lastUpdated)),
		Records:   recordsLabel(feed.count, "records"),
		Frequency: "1-3m",
		Detail:    detail,
	}
}

func loadTrackedProcessSnapshots(repoRoot string) map[string]trackedProcessSnapshot {
	records := loadTrackedProcessRecords(filepath.Join(repoRoot, ".aurora", "processes.json"))
	snapshots := make(map[string]trackedProcessSnapshot, len(records))
	for _, record := range records {
		snapshots[record.Name] = trackedProcessSnapshot{
			Name:         record.Name,
			Running:      processRunning(record.Pid),
			LastMessage:  readLogSummary(record.Log, false),
			LastError:    readLogSummary(record.ErrorLog, true),
			LastActivity: maxTime(fileModTime(record.Log), fileModTime(record.ErrorLog)),
		}
	}
	return snapshots
}

func loadTrackedProcessRecords(path string) []trackedProcessRecord {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var records []trackedProcessRecord
	if err := json.Unmarshal(data, &records); err == nil {
		return records
	}

	var single trackedProcessRecord
	if err := json.Unmarshal(data, &single); err == nil && single.Name != "" {
		return []trackedProcessRecord{single}
	}

	return nil
}

func processRunning(pid int) bool {
	if pid <= 0 {
		return false
	}

	if runtime.GOOS == "windows" {
		output, err := exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", pid), "/FO", "CSV", "/NH").Output()
		if err != nil {
			return false
		}
		line := strings.TrimSpace(string(output))
		return line != "" && !strings.HasPrefix(line, "INFO:")
	}

	output, err := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "pid=").Output()
	return err == nil && strings.TrimSpace(string(output)) != ""
}

func readLogSummary(path string, preferError bool) string {
	if path == "" {
		return ""
	}

	data, err := os.ReadFile(path)
	if err != nil || len(data) == 0 {
		return ""
	}

	if len(data) > 32*1024 {
		data = data[len(data)-32*1024:]
	}

	lines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}
		if preferError {
			if strings.HasPrefix(line, "note:") || strings.HasPrefix(line, "thread ") || strings.HasPrefix(line, "%") {
				continue
			}
		}
		summary := summarizeLogLine(line)
		if summary != "" {
			return summary
		}
	}

	return ""
}

func summarizeLogLine(line string) string {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, "{") {
		return trimmed
	}

	var raw map[string]any
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return trimmed
	}

	parts := make([]string, 0, 6)
	if message, ok := raw["msg"].(string); ok && message != "" {
		parts = append(parts, message)
	}

	fields, _ := raw["fields"].(map[string]any)
	if message, ok := fields["message"].(string); ok && message != "" {
		parts = append(parts, message)
	}

	for _, key := range []string{"err", "status", "body", "topic", "count", "active", "satellites", "interval", "norad"} {
		if value, ok := raw[key]; ok {
			parts = append(parts, fmt.Sprintf("%s=%v", key, value))
			continue
		}
		if value, ok := fields[key]; ok {
			parts = append(parts, fmt.Sprintf("%s=%v", key, value))
		}
	}

	if len(parts) == 0 {
		return trimmed
	}

	return strings.Join(parts, " | ")
}

func discoverRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, "aurora.ps1")); err == nil {
			return dir
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return dir
		}
		dir = parent
	}
}

func formatEventTime(value time.Time) string {
	if value.IsZero() {
		return "No activity yet"
	}
	return value.UTC().Format("2006-01-02 15:04:05 UTC")
}

func recordsLabel(count int, noun string) string {
	if count <= 0 {
		return "No data"
	}
	return fmt.Sprintf("%d %s", count, noun)
}

func statusForFreshness(lastUpdated time.Time, liveWindow time.Duration, staleWindow time.Duration) string {
	if lastUpdated.IsZero() {
		return "ERROR"
	}

	age := time.Since(lastUpdated)
	if age <= liveWindow {
		return "LIVE"
	}
	if age <= staleWindow {
		return "STALE"
	}
	return "ERROR"
}

func fileModTime(path string) time.Time {
	if path == "" {
		return time.Time{}
	}
	info, err := os.Stat(path)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

func maxTime(left time.Time, right time.Time) time.Time {
	if left.After(right) {
		return left
	}
	return right
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
