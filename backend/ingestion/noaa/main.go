package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
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
		Name:    "aurora_noaa_fetch_duration_seconds",
		Help:    "Duration of NOAA SWPC fetch requests",
		Buckets: prometheus.DefBuckets,
	}, []string{"endpoint"})

	fetchErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "aurora_noaa_fetch_errors_total",
		Help: "Total NOAA fetch errors",
	}, []string{"endpoint"})

	kpGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aurora_kp_index_current",
		Help: "Current Kp index",
	})

	windSpeedGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aurora_solar_wind_speed_kms",
		Help: "Current solar wind speed in km/s",
	})

	bzGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aurora_bz_component_nt",
		Help: "Current Bz component in nT",
	})
)

// ── State ───────────────────────────────────────────────────────────────────

type weatherState struct {
	mu               sync.Mutex
	kpIndex          float64
	solarWindSpeed   float64
	solarWindDensity float64
	bzComponent      float64
	xrayFlux         string
	dirty            bool
	observed         map[string]time.Time
}

func (s *weatherState) toMessage() shared.SpaceWeather {
	s.mu.Lock()
	defer s.mu.Unlock()
	return shared.SpaceWeather{
		KpIndex:          s.kpIndex,
		SolarWindSpeed:   s.solarWindSpeed,
		SolarWindDensity: s.solarWindDensity,
		BzComponent:      s.bzComponent,
		XrayFlux:         s.xrayFlux,
		StormLevel:       shared.DeriveStormLevel(s.kpIndex),
		AuroraKp:         math.Floor(s.kpIndex),
		LastUpdated:      time.Now().UTC().Format(time.RFC3339),
	}
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

var httpClient = &http.Client{Timeout: 30 * time.Second}

func fetchJSON(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "AURORA-SSA/1.0 aurora@sripadsirik")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}

	return io.ReadAll(resp.Body)
}

// ── Parsers ─────────────────────────────────────────────────────────────────

func parseKpIndex(ctx context.Context, state *weatherState) {
	const endpoint = "kp-index"
	const url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"

	start := time.Now()
	body, err := fetchJSON(ctx, url)
	fetchDuration.WithLabelValues(endpoint).Observe(time.Since(start).Seconds())

	if err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("kp fetch failed", "err", err)
		return
	}

	kp, observedAt, err := latestKpObservation(body)
	if err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("kp parse failed", "err", err)
		return
	}

	state.mu.Lock()
	state.kpIndex = kp
	state.markObserved("kp", observedAt)
	state.mu.Unlock()

	kpGauge.Set(kp)
	slog.Info("kp updated", "kp", kp)
}

func parseSolarWind(ctx context.Context, state *weatherState) {
	const endpoint = "solar-wind"
	const url = "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json"

	start := time.Now()
	body, err := fetchJSON(ctx, url)
	fetchDuration.WithLabelValues(endpoint).Observe(time.Since(start).Seconds())

	if err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("solar wind fetch failed", "err", err)
		return
	}

	record, observedAt, err := latestWindObservation(body, false)
	if err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("solar wind parse failed", "err", err)
		return
	}
	state.mu.Lock()
	state.solarWindDensity = *record.Density
	state.solarWindSpeed = *record.Speed
	state.markObserved("wind", observedAt)
	state.mu.Unlock()
	windSpeedGauge.Set(*record.Speed)
	slog.Info("solar wind updated", "speed", *record.Speed, "density", *record.Density)
}

func parseBz(ctx context.Context, state *weatherState) {
	const endpoint = "bz"
	const url = "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json"

	start := time.Now()
	body, err := fetchJSON(ctx, url)
	fetchDuration.WithLabelValues(endpoint).Observe(time.Since(start).Seconds())

	if err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("bz fetch failed", "err", err)
		return
	}

	record, observedAt, err := latestWindObservation(body, true)
	if err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("bz parse failed", "err", err)
		return
	}
	state.mu.Lock()
	state.bzComponent = *record.Bz
	state.markObserved("bz", observedAt)
	state.mu.Unlock()
	bzGauge.Set(*record.Bz)
	slog.Info("bz updated", "bz", *record.Bz)
}

func parseXray(ctx context.Context, state *weatherState) {
	const endpoint = "xray"
	const url = "https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json"

	start := time.Now()
	body, err := fetchJSON(ctx, url)
	fetchDuration.WithLabelValues(endpoint).Observe(time.Since(start).Seconds())

	if err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("xray fetch failed", "err", err)
		return
	}

	// Array of objects: { "time_tag": "...", "satellite": 16, "flux": 1.23e-6, "observed_flux": ..., "energy": "0.1-0.8nm" }
	type xrayRecord struct {
		TimeTag string  `json:"time_tag"`
		Flux    float64 `json:"flux"`
		Energy  string  `json:"energy"`
	}

	var records []xrayRecord
	if err := json.Unmarshal(body, &records); err != nil {
		fetchErrors.WithLabelValues(endpoint).Inc()
		slog.Error("xray parse failed", "err", err)
		return
	}

	var newest xrayRecord
	var newestTime time.Time
	for _, rec := range records {
		if rec.Energy != "0.1-0.8nm" || rec.Flux <= 0 {
			continue
		}
		observedAt, err := observationTime(rec.TimeTag)
		if err == nil && observedAt.After(newestTime) {
			newest, newestTime = rec, observedAt
		}
	}
	if newestTime.IsZero() {
		return
	}
	fluxClass := classifyXrayFlux(newest.Flux)
	state.mu.Lock()
	state.xrayFlux = fluxClass
	state.markObserved("xray", newestTime)
	state.mu.Unlock()
	slog.Info("xray updated", "flux", newest.Flux, "class", fluxClass, "observedAt", newestTime)

}

// classifyXrayFlux converts a flux value (W/m²) to NOAA class string like "C2.4".
func classifyXrayFlux(flux float64) string {
	if flux <= 0 {
		return "A0.0"
	}

	classes := []struct {
		letter    string
		threshold float64
	}{
		{"X", 1e-4},
		{"M", 1e-5},
		{"C", 1e-6},
		{"B", 1e-7},
		{"A", 1e-8},
	}

	for _, c := range classes {
		if flux >= c.threshold {
			value := flux / c.threshold
			return fmt.Sprintf("%s%.1f", c.letter, value)
		}
	}

	return "A0.0"
}

// ── Publish ─────────────────────────────────────────────────────────────────

func publishIfDirty(ctx context.Context, state *weatherState, producer *shared.Producer) {
	state.mu.Lock()
	if !state.dirty || !state.ready(time.Now()) {
		state.mu.Unlock()
		return
	}
	state.dirty = false
	state.mu.Unlock()

	msg := state.toMessage()
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("marshal weather failed", "err", err)
		return
	}

	if err := producer.Publish(ctx, "latest", data); err != nil {
		slog.Error("publish weather failed", "err", err)
	} else {
		slog.Info("published space weather", "kp", msg.KpIndex, "wind", msg.SolarWindSpeed)
	}
}

// ── Main ────────────────────────────────────────────────────────────────────

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	if err := shared.LoadDotEnv(".env"); err != nil {
		slog.Warn("dotenv load failed", "path", ".env", "err", err)
	}

	brokers := strings.Split(envOr("KAFKA_BROKERS", "localhost:9092"), ",")
	metricsPort := envOr("METRICS_PORT_NOAA", "2113")

	producer := shared.NewProducer(brokers, shared.TopicSpaceWeatherProcessed)

	// Metrics endpoint
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

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	state := &weatherState{xrayFlux: "B1.0"}

	// Initial fetch of all endpoints
	parseKpIndex(ctx, state)
	parseSolarWind(ctx, state)
	parseBz(ctx, state)
	parseXray(ctx, state)
	publishIfDirty(ctx, state, producer)

	// Tickers
	kpTicker := time.NewTicker(3 * time.Minute)
	windTicker := time.NewTicker(1 * time.Minute)
	bzTicker := time.NewTicker(1 * time.Minute)
	xrayTicker := time.NewTicker(1 * time.Minute)
	defer kpTicker.Stop()
	defer windTicker.Stop()
	defer bzTicker.Stop()
	defer xrayTicker.Stop()

	slog.Info("noaa ingestion running")

	for {
		select {
		case <-kpTicker.C:
			parseKpIndex(ctx, state)
			publishIfDirty(ctx, state, producer)
		case <-windTicker.C:
			parseSolarWind(ctx, state)
			publishIfDirty(ctx, state, producer)
		case <-bzTicker.C:
			parseBz(ctx, state)
			publishIfDirty(ctx, state, producer)
		case <-xrayTicker.C:
			parseXray(ctx, state)
			publishIfDirty(ctx, state, producer)
		case sig := <-sigCh:
			slog.Info("shutting down", "signal", sig)
			cancel()
			if err := producer.Close(); err != nil {
				slog.Error("producer close failed", "err", err)
			}
			slog.Info("noaa ingestion stopped")
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
