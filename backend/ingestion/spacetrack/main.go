package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/signal"
	"strconv"
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
	fetchErrors = promauto.NewCounter(prometheus.CounterOpts{
		Name: "aurora_spacetrack_fetch_errors_total",
		Help: "Total Space-Track fetch errors",
	})

	activeConjunctions = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aurora_conjunctions_active",
		Help: "Count of warning+critical conjunction events",
	})
)

// ── Space-Track session ─────────────────────────────────────────────────────

type session struct {
	mu       sync.Mutex
	client   *http.Client
	user     string
	pass     string
	loggedIn bool
}

func newSession(user, pass string) *session {
	jar, _ := cookiejar.New(nil)
	return &session{
		client: &http.Client{Timeout: 60 * time.Second, Jar: jar},
		user:   user,
		pass:   pass,
	}
}

func (s *session) login(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	form := url.Values{}
	form.Set("identity", s.user)
	form.Set("password", s.pass)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://www.space-track.org/ajaxauth/login",
		strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("create login request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "AURORA-SSA/1.0 aurora@sripadsirik")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("login request: %w", err)
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body) // drain

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("login returned HTTP %d", resp.StatusCode)
	}

	s.loggedIn = true
	slog.Info("space-track login successful")
	return nil
}

func (s *session) fetch(ctx context.Context, dataURL string) ([]byte, error) {
	s.mu.Lock()
	if !s.loggedIn {
		s.mu.Unlock()
		if err := s.login(ctx); err != nil {
			return nil, err
		}
	} else {
		s.mu.Unlock()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, dataURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "AURORA-SSA/1.0 aurora@sripadsirik")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Rate limited
	if resp.StatusCode == 429 {
		slog.Warn("space-track rate limited, backing off 5 minutes")
		return nil, fmt.Errorf("rate limited (429)")
	}

	// Session expired
	if resp.StatusCode == 401 {
		slog.Warn("space-track session expired, re-authenticating")
		s.mu.Lock()
		s.loggedIn = false
		s.mu.Unlock()
		if err := s.login(ctx); err != nil {
			return nil, err
		}
		// Retry once
		req2, _ := http.NewRequestWithContext(ctx, http.MethodGet, dataURL, nil)
		req2.Header.Set("User-Agent", "AURORA-SSA/1.0 aurora@sripadsirik")
		resp2, err := s.client.Do(req2)
		if err != nil {
			return nil, err
		}
		defer resp2.Body.Close()
		if resp2.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp2.Body)
			slog.Error("CDM retry failed", "status", resp2.StatusCode, "body", string(body))
			return nil, fmt.Errorf("retry returned HTTP %d: %s", resp2.StatusCode, string(body))
		}
		return io.ReadAll(resp2.Body)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Error("CDM fetch failed", "status", resp.StatusCode, "body", string(body), "url", dataURL)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

// ── CDM record from Space-Track API ─────────────────────────────────────────

type cdmRecord struct {
	CDMID    string `json:"CDM_ID"`
	TCA      string `json:"TCA"`
	MinRng   string `json:"MIN_RNG"`
	Pc       string `json:"PC"`
	Sat1ID   string `json:"SAT_1_ID"`
	Sat1Name string `json:"SAT_1_NAME"`
	Sat2ID   string `json:"SAT_2_ID"`
	Sat2Name string `json:"SAT_2_NAME"`
}

func parseCDMs(body []byte) ([]shared.ConjunctionWarning, error) {
	var rawJSON []json.RawMessage
	if err := json.Unmarshal(body, &rawJSON); err != nil {
		return nil, err
	}

	if len(rawJSON) > 0 {
		slog.Info("raw CDM sample", "first", string(rawJSON[0]))
	}

	var records []cdmRecord
	if err := json.Unmarshal(body, &records); err != nil {
		return nil, err
	}

	warnings := make([]shared.ConjunctionWarning, 0, len(records))
	for _, rec := range records {
		// MIN_RNG from Space-Track is in meters (string), may be empty
		var missDistanceM float64
		if rec.MinRng != "" {
			if m, err := strconv.ParseFloat(rec.MinRng, 64); err == nil {
				missDistanceM = m
			} else {
				slog.Warn("invalid CDM MIN_RNG", "id", rec.CDMID, "value", rec.MinRng, "err", err)
			}
		}
		missDistanceKm := missDistanceM / 1000.0

		// PC comes as a string like "1.23456e-05"
		var pc float64
		if rec.Pc != "" {
			if p, err := strconv.ParseFloat(rec.Pc, 64); err == nil {
				pc = p
			} else {
				slog.Warn("invalid CDM PC", "id", rec.CDMID, "value", rec.Pc, "err", err)
			}
		}

		var norad1 int
		if rec.Sat1ID != "" {
			norad1, _ = strconv.Atoi(rec.Sat1ID)
		}
		var norad2 int
		if rec.Sat2ID != "" {
			norad2, _ = strconv.Atoi(rec.Sat2ID)
		}

		riskLevel := shared.ClassifyRisk(pc)

		slog.Info(
			"parsed CDM",
			"id", rec.CDMID,
			"pc_raw", rec.Pc,
			"pc_parsed", pc,
			"miss_distance_m", missDistanceM,
			"miss_distance_km", missDistanceKm,
			"riskLevel", riskLevel,
			"sat1_id", norad1,
			"sat1", rec.Sat1Name,
			"sat2_id", norad2,
			"sat2", rec.Sat2Name,
		)

		warnings = append(warnings, shared.ConjunctionWarning{
			ID: rec.CDMID,
			Object1: shared.ConjunctionObjectRef{
				NoradID: norad1,
				Name:    rec.Sat1Name,
			},
			Object2: shared.ConjunctionObjectRef{
				NoradID: norad2,
				Name:    rec.Sat2Name,
			},
			TCA:                 rec.TCA,
			MissDistanceKm:      missDistanceKm,
			MissDistanceM:       missDistanceM,
			Pc:                  pc,
			Probability:         pc,
			RelativeVelocityKms: 0,
			RiskLevel:           riskLevel,
		})
	}

	return warnings, nil
}

// ── Main ────────────────────────────────────────────────────────────────────

// Use EMERGENCY_REPORTABLE filter — simpler and avoids 500s from Pc filter encoding issues.
// Fallback: remove all filters and just use /class/cdm_public/limit/20/format/json
const cdmURL = "https://www.space-track.org/basicspacedata/query/class/cdm_public/EMERGENCY_REPORTABLE/Y/orderby/TCA%20asc/limit/20/format/json"

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	if err := shared.LoadDotEnv(".env"); err != nil {
		slog.Warn("dotenv load failed", "path", ".env", "err", err)
	}

	user := os.Getenv("SPACETRACK_USERNAME")
	pass := os.Getenv("SPACETRACK_PASSWORD")
	if user == "" || pass == "" {
		slog.Error("SPACETRACK_USERNAME and SPACETRACK_PASSWORD must be set")
		os.Exit(1)
	}

	brokers := strings.Split(envOr("KAFKA_BROKERS", "localhost:9092"), ",")
	metricsPort := envOr("METRICS_PORT_SPACETRACK", "2116")

	producer := shared.NewProducer(brokers, shared.TopicConjunctionsAlerts)
	sess := newSession(user, pass)

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

	fetchAndPublish := func() {
		slog.Info("fetching Space-Track CDMs")
		body, err := sess.fetch(ctx, cdmURL)
		if err != nil {
			fetchErrors.Inc()
			slog.Error("CDM fetch failed", "err", err)
			return
		}

		warnings, err := parseCDMs(body)
		if err != nil {
			fetchErrors.Inc()
			slog.Error("CDM parse failed", "err", err)
			return
		}

		// Count active (warning + critical)
		active := 0
		for _, w := range warnings {
			if w.RiskLevel == "warning" || w.RiskLevel == "critical" {
				active++
			}
		}
		activeConjunctions.Set(float64(active))

		data, err := json.Marshal(warnings)
		if err != nil {
			slog.Error("marshal warnings failed", "err", err)
			return
		}

		if err := producer.Publish(ctx, "batch", data); err != nil {
			slog.Error("publish warnings failed", "err", err)
		} else {
			slog.Info("published conjunctions", "count", len(warnings), "active", active)
		}
	}

	// Initial fetch
	fetchAndPublish()

	// Fetch every 6 hours
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	slog.Info("spacetrack ingestion running", "interval", "6h")

	for {
		select {
		case <-ticker.C:
			fetchAndPublish()
		case sig := <-sigCh:
			slog.Info("shutting down", "signal", sig)
			cancel()
			if err := producer.Close(); err != nil {
				slog.Error("producer close failed", "err", err)
			}
			slog.Info("spacetrack ingestion stopped")
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
