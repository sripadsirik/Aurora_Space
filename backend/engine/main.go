package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/joshuaferrara/go-satellite"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/segmentio/kafka-go"
	"github.com/sripadsirik/aurora/shared"
)

// ── Prometheus metrics ──────────────────────────────────────────────────────

var (
	propagationLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "aurora_engine_propagation_latency_ms",
		Help:    "Propagation cycle latency in milliseconds",
		Buckets: []float64{10, 25, 50, 100, 250, 500, 1000, 2500, 5000},
	})

	satellitesTracked = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aurora_satellites_tracked",
		Help: "Number of satellites in TLE cache",
	})

	propagationErrors = promauto.NewCounter(prometheus.CounterOpts{
		Name: "aurora_engine_propagation_errors_total",
		Help: "Total SGP4 propagation errors",
	})
)

const satelliteBatchSize = 2000

// ── CelesTrak GP record (matches what celestrak ingestion publishes) ────────

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

// ── TLE cache ───────────────────────────────────────────────────────────────

type tleCache struct {
	mu      sync.RWMutex
	records map[string]gpRecord
}

func (c *tleCache) set(noradID string, rec gpRecord) {
	c.mu.Lock()
	c.records[noradID] = rec
	c.mu.Unlock()
}

func (c *tleCache) snapshot() []gpRecord {
	c.mu.RLock()
	defer c.mu.RUnlock()
	recs := make([]gpRecord, 0, len(c.records))
	for _, r := range c.records {
		recs = append(recs, r)
	}
	return recs
}

func (c *tleCache) count() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.records)
}

// ── SGP4 propagation ────────────────────────────────────────────────────────

func propagateSatellite(rec gpRecord) (result *shared.Satellite, ok bool) {
	// go-satellite panics on malformed TLEs — recover gracefully
	defer func() {
		if r := recover(); r != nil {
			result = nil
			ok = false
		}
	}()

	line1 := strings.TrimSpace(rec.TLELine1)
	line2 := strings.TrimSpace(rec.TLELine2)

	sat := satellite.TLEToSat(line1, line2, satellite.GravityWGS84)

	now := time.Now().UTC()
	year, month, day, hour, min, sec := now.Year(), int(now.Month()), now.Day(),
		now.Hour(), now.Minute(), now.Second()

	position, velocity := satellite.Propagate(sat, year, month, day, hour, min, sec)

	// Check for NaN (propagation failure)
	if math.IsNaN(position.X) || math.IsNaN(position.Y) || math.IsNaN(position.Z) {
		return nil, false
	}

	// ECI position in km → geodetic
	gmst := satellite.GSTimeFromDate(year, month, day, hour, min, sec)

	alt, _, latLon := satellite.ECIToLLA(position, gmst)

	latDeg := latLon.Latitude * 180.0 / math.Pi
	lonDeg := latLon.Longitude * 180.0 / math.Pi

	// Velocity magnitude in km/s
	velKms := math.Sqrt(velocity.X*velocity.X + velocity.Y*velocity.Y + velocity.Z*velocity.Z)

	noradID := rec.NoradCatID

	return &shared.Satellite{
		NoradID:          noradID,
		Name:             rec.ObjectName,
		Lat:              latDeg,
		Lon:              lonDeg,
		AltitudeKm:       alt,
		VelocityKms:      velKms,
		OrbitType:        shared.ClassifyOrbit(alt),
		RiskLevel:        "nominal",
		Owner:            "",
		ConjunctionCount: 0,
	}, true
}

// ── Ingest a single TLE message into the cache ─────────────────────────────

func ingestTLE(data []byte, cache *tleCache) bool {
	var rec gpRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return false
	}
	if rec.NoradCatID == 0 {
		return false
	}
	cache.set(strconv.Itoa(rec.NoradCatID), rec)
	return true
}

// ── Phase 1: Bulk-load all TLEs from topic beginning ────────────────────────
// Uses a plain reader (no consumer group) so it always reads from offset 0,
// regardless of previously committed offsets.

func bulkLoadTLEs(ctx context.Context, cache *tleCache, brokers []string) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     brokers,
		Topic:       shared.TopicSatellitesTLE,
		MinBytes:    1,
		MaxBytes:    10e6,
		StartOffset: kafka.FirstOffset,
		MaxWait:     500 * time.Millisecond,
		// No GroupID — plain reader always starts from FirstOffset
	})
	defer reader.Close()

	slog.Info("TLE bulk load started")
	ingested := 0
	deadline := time.Now().Add(10 * time.Second)

	for {
		readCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		msg, err := reader.ReadMessage(readCtx)
		cancel()

		if err != nil {
			// Timeout = caught up with topic end
			slog.Info("initial TLE load complete", "ingested", ingested, "unique", cache.count())
			return
		}

		if ingestTLE(msg.Value, cache) {
			ingested++
		}

		if ingested%5000 == 0 && ingested > 0 {
			slog.Info("TLE bulk load progress", "ingested", ingested, "unique", cache.count())
		}

		if time.Now().After(deadline) {
			slog.Info("initial TLE load complete (deadline)", "ingested", ingested, "unique", cache.count())
			return
		}
	}
}

// ── Phase 2: Ongoing TLE consumer (picks up new/updated TLEs) ──────────────

func consumeTLEUpdates(ctx context.Context, cache *tleCache, brokers []string) {
	consumer := shared.NewConsumer(brokers, shared.TopicSatellitesTLE, "aurora-engine")
	defer consumer.Close()

	slog.Info("TLE update consumer started")

	for {
		if ctx.Err() != nil {
			return
		}

		data, err := consumer.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Warn("TLE read error", "err", err)
			continue
		}

		ingestTLE(data, cache)
	}
}

// ── Propagation loop ────────────────────────────────────────────────────────

func propagationLoop(ctx context.Context, cache *tleCache, producer *shared.Producer) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	slog.Info("propagation loop started", "interval", "30s")

	// Run first propagation immediately
	propagateAndPublish(ctx, cache, producer)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			propagateAndPublish(ctx, cache, producer)
		}
	}
}

// isTLEValid pre-checks orbital elements to skip TLEs that cause
// the go-satellite library to hang (infinite loops on degenerate orbits).
func isTLEValid(rec gpRecord) bool {
	line1 := strings.TrimSpace(rec.TLELine1)
	line2 := strings.TrimSpace(rec.TLELine2)
	if len(line1) < 69 || len(line2) < 69 {
		return false
	}
	if !strings.HasPrefix(line1, "1 ") || !strings.HasPrefix(line2, "2 ") {
		return false
	}
	if rec.Eccentricity >= 1.0 || rec.Eccentricity < 0 {
		return false // hyperbolic or invalid
	}
	if rec.MeanMotion <= 0 {
		return false // no valid orbit
	}
	if rec.Eccentricity > 0.9 {
		return false // near-parabolic, SGP4 unreliable
	}
	return true
}

func publishSatelliteBatches(ctx context.Context, producer *shared.Producer, positions []shared.Satellite) error {
	batchCount := (len(positions) + satelliteBatchSize - 1) / satelliteBatchSize
	batchID := strconv.FormatInt(time.Now().UnixNano(), 10)

	for batchIndex := 0; batchIndex < batchCount; batchIndex++ {
		start := batchIndex * satelliteBatchSize
		end := start + satelliteBatchSize
		if end > len(positions) {
			end = len(positions)
		}

		payload := shared.SatelliteBatch{
			BatchID:    batchID,
			BatchIndex: batchIndex,
			BatchCount: batchCount,
			Satellites: positions[start:end],
		}

		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}

		key := batchID + "-" + strconv.Itoa(batchIndex)
		if err := producer.Publish(ctx, key, data); err != nil {
			return err
		}
	}

	return nil
}

func propagateAndPublish(ctx context.Context, cache *tleCache, producer *shared.Producer) {
	records := cache.snapshot()
	if len(records) == 0 {
		return
	}

	satellitesTracked.Set(float64(len(records)))
	slog.Info("propagation starting", "total", len(records))

	start := time.Now()

	// Pre-filter valid TLEs
	valid := make([]gpRecord, 0, len(records))
	skipped := 0
	for _, rec := range records {
		if isTLEValid(rec) {
			valid = append(valid, rec)
		} else {
			skipped++
		}
	}
	slog.Info("TLE validation done", "valid", len(valid), "skipped", skipped)

	positions := make([]shared.Satellite, 0, len(valid))
	errCount := 0

	for i, rec := range valid {
		sat, ok := propagateSatellite(rec)
		if !ok {
			errCount++
			continue
		}
		positions = append(positions, *sat)
		if (i+1)%1000 == 0 {
			slog.Info("propagation progress", "processed", i+1, "ok", len(positions), "errors", errCount)
		}
	}

	elapsedMs := float64(time.Since(start).Milliseconds())
	propagationLatency.Observe(elapsedMs)
	propagationErrors.Add(float64(errCount))

	if len(positions) == 0 {
		return
	}

	slog.Info("propagation complete", "satellites", len(positions), "errors", errCount, "duration_ms", elapsedMs)

	if err := publishSatelliteBatches(ctx, producer, positions); err != nil {
		slog.Error("publish positions failed", "err", err)
	} else {
		slog.Info(
			"published positions",
			"count", len(positions),
			"batches", (len(positions)+satelliteBatchSize-1)/satelliteBatchSize,
			"latency_ms", elapsedMs,
		)
	}
}

// ── Main ────────────────────────────────────────────────────────────────────

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	brokers := strings.Split(envOr("KAFKA_BROKERS", "localhost:9092"), ",")
	metricsPort := envOr("METRICS_PORT_ENGINE", "2114")

	producer := shared.NewProducer(brokers, shared.TopicSatellitesPositions)
	cache := &tleCache{records: make(map[string]gpRecord)}

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

	// Phase 1: Bulk-load all TLEs synchronously (blocks until done or 15s)
	slog.Info("aurora sgp4 engine starting — bulk loading TLEs")
	bulkLoadTLEs(ctx, cache, brokers)
	slog.Info("TLE load ready, starting propagation", "satellites", cache.count())

	// Phase 2: Background consumer for ongoing TLE updates
	go consumeTLEUpdates(ctx, cache, brokers)

	// Start propagation loop (first cycle runs immediately)
	go propagationLoop(ctx, cache, producer)

	slog.Info("aurora sgp4 engine running")

	sig := <-sigCh
	slog.Info("shutting down", "signal", sig)
	cancel()

	if err := producer.Close(); err != nil {
		slog.Error("producer close failed", "err", err)
	}

	slog.Info("aurora sgp4 engine stopped")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
