package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sripadsirik/aurora/shared"
)

// ── Prometheus metrics ──────────────────────────────────────────────────────

var (
	fetchDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "aurora_celestrak_fetch_duration_seconds",
		Help:    "Duration of CelesTrak fetch requests",
		Buckets: prometheus.DefBuckets,
	}, []string{"group"})

	fetchErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "aurora_celestrak_fetch_errors_total",
		Help: "Total CelesTrak fetch errors",
	}, []string{"group"})

	satellitesFetched = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "aurora_celestrak_satellites_fetched",
		Help: "Number of satellites fetched per group",
	}, []string{"group"})
)

// ── CelesTrak GP JSON record ────────────────────────────────────────────────

type gpRecord struct {
	ObjectName    string  `json:"OBJECT_NAME"`
	NoradCatID    int     `json:"NORAD_CAT_ID"`
	ObjectType    string  `json:"OBJECT_TYPE"`
	TLELine1      string  `json:"TLE_LINE1"`
	TLELine2      string  `json:"TLE_LINE2"`
	MeanMotion    float64 `json:"MEAN_MOTION"`
	Inclination   float64 `json:"INCLINATION"`
	Eccentricity  float64 `json:"ECCENTRICITY"`
	Period        float64 `json:"PERIOD"`
	Apoapsis      float64 `json:"APOAPSIS"`
	Periapsis     float64 `json:"PERIAPSIS"`
	SemiMajorAxis float64 `json:"SEMIMAJOR_AXIS"`
}

// ── Fetch groups ────────────────────────────────────────────────────────────

type fetchGroup struct {
	name string
	url  string
}

var groups = []fetchGroup{
	{name: "active", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=3LE"},
	{name: "starlink", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=3LE"},
	{name: "cosmos-1408-debris", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=3LE"},
	{name: "fengyun-1c-debris", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=3LE"},
	{name: "iridium-33-debris", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=3LE"},
	{name: "cosmos-2251-debris", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=3LE"},
	{name: "2019-006", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=2019-006&FORMAT=3LE"},
	{name: "analyst", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=analyst&FORMAT=3LE"},
	{name: "stations", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=3LE"},
	{name: "visual", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=3LE"},
	{name: "weather", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=3LE"},
	{name: "resource", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=3LE"},
	{name: "science", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=science&FORMAT=3LE"},
	{name: "geo", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=3LE"},
	{name: "gpz", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gpz&FORMAT=3LE"},
	{name: "gpz-plus", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gpz-plus&FORMAT=3LE"},
	{name: "last-30-days", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=3LE"},
}

// ── HTTP client with retry ──────────────────────────────────────────────────

var httpClient = &http.Client{Timeout: 30 * time.Second}

func fetchWithRetry(ctx context.Context, url string) ([]byte, error) {
	backoff := []time.Duration{1 * time.Second, 2 * time.Second, 4 * time.Second}

	for attempt := 0; attempt <= len(backoff); attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff[attempt-1]):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("User-Agent", "AURORA-SSA/1.0 aurora@sripadsirik")

		resp, err := httpClient.Do(req)
		if err != nil {
			slog.Warn("fetch attempt failed", "attempt", attempt+1, "url", url, "err", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			slog.Warn("non-200 response", "status", resp.StatusCode, "attempt", attempt+1, "url", url)
			continue
		}
		if err != nil {
			slog.Warn("read body failed", "attempt", attempt+1, "err", err)
			continue
		}

		return body, nil
	}

	return nil, fmt.Errorf("all retries exhausted for %s", url)
}

// ── Fetch and publish one group ─────────────────────────────────────────────

func parseNoradCatID(line1 string) (int, bool) {
	if len(line1) < 7 {
		return 0, false
	}

	value, err := strconv.Atoi(strings.TrimSpace(line1[2:7]))
	if err != nil {
		return 0, false
	}

	return value, true
}

func parseEccentricity(line2 string) float64 {
	if len(line2) < 33 {
		return 0
	}

	value, err := strconv.ParseFloat("0."+strings.TrimSpace(line2[26:33]), 64)
	if err != nil {
		return 0
	}

	return value
}

func parseMeanMotion(line2 string) float64 {
	if len(line2) < 63 {
		return 0
	}

	value, err := strconv.ParseFloat(strings.TrimSpace(line2[52:63]), 64)
	if err != nil {
		return 0
	}

	return value
}

func parseThreeLineElements(body []byte) []gpRecord {
	records := make([]gpRecord, 0)
	scanner := bufio.NewScanner(bytes.NewReader(body))
	lines := make([]string, 0)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			lines = append(lines, line)
		}
	}

parseLoop:
	for i := 0; i < len(lines); {
		var name, line1, line2 string

		switch {
		case strings.HasPrefix(lines[i], "1 "):
			if i+1 >= len(lines) {
				i++
				continue
			}
			line1 = lines[i]
			line2 = lines[i+1]
			i += 2
		default:
			if i+2 >= len(lines) {
				break parseLoop
			}
			name = lines[i]
			line1 = lines[i+1]
			line2 = lines[i+2]
			i += 3
		}

		if !strings.HasPrefix(line1, "1 ") || !strings.HasPrefix(line2, "2 ") {
			continue
		}

		noradID, ok := parseNoradCatID(line1)
		if !ok {
			continue
		}

		records = append(records, gpRecord{
			ObjectName:   name,
			NoradCatID:   noradID,
			TLELine1:     line1,
			TLELine2:     line2,
			MeanMotion:   parseMeanMotion(line2),
			Eccentricity: parseEccentricity(line2),
		})
	}

	return records
}

func fetchAndPublish(ctx context.Context, group fetchGroup, producer *shared.Producer) {
	slog.Info("fetching CelesTrak group", "group", group.name)
	start := time.Now()

	body, err := fetchWithRetry(ctx, group.url)
	elapsed := time.Since(start).Seconds()
	fetchDuration.WithLabelValues(group.name).Observe(elapsed)

	if err != nil {
		fetchErrors.WithLabelValues(group.name).Inc()
		slog.Error("fetch failed", "group", group.name, "duration", elapsed, "err", err)
		return
	}

	slog.Info("fetch complete", "group", group.name, "bytes", len(body), "duration_s", fmt.Sprintf("%.2f", elapsed))

	records := parseThreeLineElements(body)
	if len(records) == 0 {
		fetchErrors.WithLabelValues(group.name).Inc()
		slog.Error("TLE parse failed", "group", group.name, "err", "no valid 3LE records")
		return
	}

	satellitesFetched.WithLabelValues(group.name).Set(float64(len(records)))
	slog.Info("parsed satellites", "group", group.name, "count", len(records))

	for _, rec := range records {
		data, err := json.Marshal(rec)
		if err != nil {
			slog.Warn("marshal record failed", "name", rec.ObjectName, "err", err)
			continue
		}

		key := rec.ObjectName
		if rec.NoradCatID > 0 {
			key = strconv.Itoa(rec.NoradCatID)
		}

		if err := producer.Publish(ctx, key, data); err != nil {
			slog.Warn("publish failed", "norad", key, "err", err)
		}
	}

	slog.Info("published to Kafka", "group", group.name, "count", len(records))
}

// ── Main ────────────────────────────────────────────────────────────────────

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	if err := shared.LoadDotEnv(".env"); err != nil {
		slog.Warn("dotenv load failed", "path", ".env", "err", err)
	}

	brokers := strings.Split(envOr("KAFKA_BROKERS", "localhost:9092"), ",")
	metricsPort := envOr("METRICS_PORT_CELESTRAK", "2115")

	producer := shared.NewProducer(brokers, shared.TopicSatellitesTLE)

	// Prometheus metrics endpoint
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		addr := ":" + metricsPort
		slog.Info("metrics server starting", "addr", addr)
		if err := http.ListenAndServe(addr, mux); err != nil {
			slog.Error("metrics server failed", "err", err)
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Run initial fetch
	for _, g := range groups {
		fetchAndPublish(ctx, g, producer)
	}

	// Fetch every 2 hours
	ticker := time.NewTicker(2 * time.Hour)
	defer ticker.Stop()

	slog.Info("celestrak ingestion running", "interval", "2h")

	for {
		select {
		case <-ticker.C:
			for _, g := range groups {
				fetchAndPublish(ctx, g, producer)
			}
		case sig := <-sigCh:
			slog.Info("shutting down", "signal", sig)
			cancel()
			if err := producer.Close(); err != nil {
				slog.Error("producer close failed", "err", err)
			}
			slog.Info("celestrak ingestion stopped")
			return
		}
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
