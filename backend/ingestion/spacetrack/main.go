package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
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

// Providers emit numeric fields as strings, numbers or null. Validate per row.
type cdmNumber string

func (n *cdmNumber) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*n = ""
		return nil
	}
	var value string
	if len(data) > 0 && data[0] == '"' {
		if err := json.Unmarshal(data, &value); err != nil {
			return err
		}
	} else {
		value = string(data)
	}
	*n = cdmNumber(value)
	return nil
}
func (n cdmNumber) Float64() (float64, error) { return strconv.ParseFloat(string(n), 64) }

type cdmRecord struct {
	CDMID    string    `json:"CDM_ID"`
	Created  string    `json:"CREATED"`
	TCA      string    `json:"TCA"`
	MinRng   cdmNumber `json:"MIN_RNG"`
	Pc       cdmNumber `json:"PC"`
	Sat1ID   cdmNumber `json:"SAT_1_ID"`
	Sat1Name string    `json:"SAT_1_NAME"`
	Sat2ID   cdmNumber `json:"SAT_2_ID"`
	Sat2Name string    `json:"SAT_2_NAME"`
}

func cdmTime(value string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.999999999", "2006-01-02 15:04:05.999999999"} {
		if stamp, err := time.Parse(layout, value); err == nil {
			return stamp.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid CDM timestamp")
}

func parseCDMs(body []byte) ([]shared.ConjunctionWarning, error) {
	return parseCurrentCDMs(body, time.Now().UTC())
}

func parseCurrentCDMs(body []byte, now time.Time) ([]shared.ConjunctionWarning, error) {
	var records []cdmRecord
	if err := json.Unmarshal(body, &records); err != nil {
		return nil, err
	}
	warnings := make([]shared.ConjunctionWarning, 0, len(records))
	for _, rec := range records {
		tca, e1 := cdmTime(rec.TCA)
		created, e2 := cdmTime(rec.Created)
		miss, e3 := rec.MinRng.Float64()
		pc, e4 := rec.Pc.Float64()
		id1, e5 := strconv.Atoi(string(rec.Sat1ID))
		id2, e6 := strconv.Atoi(string(rec.Sat2ID))
		// Missing probability/distance is unknown, never zero or "nominal".
		if e1 != nil || e2 != nil || e3 != nil || e4 != nil || e5 != nil || e6 != nil || rec.CDMID == "" || id1 <= 0 || id2 <= 0 || id1 == id2 || math.IsNaN(pc) || math.IsInf(pc, 0) || math.IsNaN(miss) || math.IsInf(miss, 0) || pc < 0 || pc > 1 || miss < 0 {
			continue
		}
		if !tca.After(now) || tca.After(now.Add(7*24*time.Hour)) || created.Before(now.Add(-72*time.Hour)) || created.After(now.Add(5*time.Minute)) {
			continue
		}
		warnings = append(warnings, shared.ConjunctionWarning{
			ID: rec.CDMID, CreatedAt: created.Format(time.RFC3339Nano), Source: "Space-Track CDM public",
			Object1: shared.ConjunctionObjectRef{NoradID: id1, Name: rec.Sat1Name},
			Object2: shared.ConjunctionObjectRef{NoradID: id2, Name: rec.Sat2Name},
			TCA:     tca.Format(time.RFC3339Nano), MissDistanceM: miss, MissDistanceKm: miss / 1000,
			Pc: pc, Probability: pc, RiskLevel: shared.ClassifyRisk(pc),
		})
	}
	// Successive reports (including reversed object pairs) describe one encounter.
	sort.Slice(warnings, func(i, j int) bool {
		a, _ := cdmTime(warnings[i].CreatedAt)
		b, _ := cdmTime(warnings[j].CreatedAt)
		return a.After(b)
	})
	unique := make([]shared.ConjunctionWarning, 0, len(warnings))
	encounters := make(map[[2]int][]time.Time)
	for _, w := range warnings {
		a, b := w.Object1.NoradID, w.Object2.NoradID
		if a > b {
			a, b = b, a
		}
		key := [2]int{a, b}
		tca, _ := cdmTime(w.TCA)
		duplicate := false
		for _, other := range encounters[key] {
			if math.Abs(tca.Sub(other).Minutes()) < 30 {
				duplicate = true
				break
			}
		}
		if !duplicate {
			unique = append(unique, w)
			encounters[key] = append(encounters[key], tca)
		}
	}
	sort.Slice(unique, func(i, j int) bool {
		a, _ := cdmTime(unique[i].TCA)
		b, _ := cdmTime(unique[j].TCA)
		return a.Before(b)
	})
	return unique, nil
}

// ── Main ────────────────────────────────────────────────────────────────────

// Bound by report age and future TCA, never the oldest N historical records.
const cdmURL = "https://www.space-track.org/basicspacedata/query/class/cdm_public/CREATED/%3Enow-3/TCA/%3Enow/orderby/CREATED%20desc/format/json"

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

	cachePath := envOr("SPACETRACK_CACHE_PATH", ".aurora/cdm-current-v1.json")
	var nextFetch time.Time
	fetchAndPublish := func() {
		if time.Now().Before(nextFetch) {
			return
		}
		var cached struct {
			FetchedAt time.Time       `json:"fetchedAt"`
			Body      json.RawMessage `json:"body"`
		}
		if data, err := os.ReadFile(cachePath); err == nil {
			_ = json.Unmarshal(data, &cached)
		}
		body := []byte(cached.Body)
		fetchedAt := cached.FetchedAt
		fromCache := !fetchedAt.IsZero() && fetchedAt.Before(time.Now().Add(time.Minute)) && time.Since(fetchedAt) < 8*time.Hour && len(body) > 0
		if !fromCache {
			slog.Info("fetching current Space-Track CDMs")
			var err error
			body, err = sess.fetch(ctx, cdmURL)
			if err != nil {
				fetchErrors.Inc()
				slog.Error("CDM fetch failed", "err", err)
				nextFetch = time.Now().Add(15 * time.Minute)
				return
			}
			fetchedAt = time.Now().UTC()
		}

		warnings, err := parseCDMs(body)
		if err != nil {
			fetchErrors.Inc()
			slog.Error("CDM parse failed", "err", err)
			nextFetch = time.Now().Add(15 * time.Minute)
			return
		}

		nextFetch = fetchedAt.Add(8 * time.Hour)
		if !fromCache {
			cached.FetchedAt = fetchedAt
			cached.Body = body
			if data, err := json.Marshal(cached); err == nil {
				if err := os.MkdirAll(filepath.Dir(cachePath), 0700); err == nil {
					if err := os.WriteFile(cachePath+".tmp", data, 0600); err == nil {
						_ = os.Rename(cachePath+".tmp", cachePath)
					}
				}
			}
		}
		// Count active (warning + critical)
		active := 0
		for _, w := range warnings {
			if w.RiskLevel == "warning" || w.RiskLevel == "critical" {
				active++
			}
		}
		activeConjunctions.Set(float64(active))

		data, err := json.Marshal(shared.ConjunctionFeed{Events: warnings, FetchedAt: fetchedAt.Format(time.RFC3339Nano), Source: "Space-Track CDM public"})
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

	// Check schedule each minute; fetch at most once every 8 hours across restarts.
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	slog.Info("spacetrack ingestion running", "interval", "8h")

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
