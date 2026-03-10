package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sripadsirik/aurora/shared"
)

// ── Prometheus metrics ──────────────────────────────────────────────────────

var (
	wsConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aurora_websocket_clients_connected",
		Help: "Current WebSocket connections",
	})

	wsMessagesSent = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "aurora_websocket_messages_sent_total",
		Help: "Total WebSocket messages sent",
	}, []string{"type"})

	kafkaMessagesConsumed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "aurora_kafka_messages_consumed_total",
		Help: "Total Kafka messages consumed",
	}, []string{"topic"})
)

// ── WebSocket hub ───────────────────────────────────────────────────────────

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true }, // CORS for dev
}

type client struct {
	conn *websocket.Conn
	send chan []byte
}

type hub struct {
	mu      sync.RWMutex
	clients map[*client]bool
}

func newHub() *hub {
	return &hub{clients: make(map[*client]bool)}
}

func (h *hub) register(c *client) {
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
	wsConnections.Set(float64(h.count()))
}

func (h *hub) unregister(c *client) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.send)
	}
	h.mu.Unlock()
	wsConnections.Set(float64(h.count()))
}

func (h *hub) count() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func (h *hub) broadcast(msgType string, payload json.RawMessage) {
	msg := shared.WSMessage{Type: msgType, Payload: payload}
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("marshal broadcast failed", "err", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for c := range h.clients {
		select {
		case c.send <- data:
			wsMessagesSent.WithLabelValues(msgType).Inc()
		default:
			// Client too slow, drop message
		}
	}
}

// ── State cache (last known state for new connections) ──────────────────────

type stateCache struct {
	mu           sync.RWMutex
	satellites   json.RawMessage
	conjunctions json.RawMessage
	spaceWeather json.RawMessage
}

type pendingSatelliteBatch struct {
	batchCount int
	parts      map[int][]shared.Satellite
	receivedAt time.Time
}

type satelliteBatchAssembler struct {
	mu      sync.Mutex
	batches map[string]*pendingSatelliteBatch
}

func newSatelliteBatchAssembler() *satelliteBatchAssembler {
	return &satelliteBatchAssembler{batches: make(map[string]*pendingSatelliteBatch)}
}

func (a *satelliteBatchAssembler) ingest(data []byte) (json.RawMessage, bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	var batch shared.SatelliteBatch
	if err := json.Unmarshal(data, &batch); err != nil {
		var satellites []shared.Satellite
		if err := json.Unmarshal(data, &satellites); err != nil {
			return nil, false, err
		}
		return json.RawMessage(data), true, nil
	}

	if batch.BatchCount <= 1 {
		payload, err := json.Marshal(batch.Satellites)
		if err != nil {
			return nil, false, err
		}
		return payload, true, nil
	}

	now := time.Now()
	for batchID, pending := range a.batches {
		if now.Sub(pending.receivedAt) > time.Minute {
			delete(a.batches, batchID)
		}
	}

	pending, ok := a.batches[batch.BatchID]
	if !ok {
		pending = &pendingSatelliteBatch{
			batchCount: batch.BatchCount,
			parts:      make(map[int][]shared.Satellite, batch.BatchCount),
			receivedAt: now,
		}
		a.batches[batch.BatchID] = pending
	}

	pending.receivedAt = now
	pending.parts[batch.BatchIndex] = batch.Satellites
	if len(pending.parts) < pending.batchCount {
		return nil, false, nil
	}

	satellites := make([]shared.Satellite, 0)
	for batchIndex := 0; batchIndex < pending.batchCount; batchIndex++ {
		part, exists := pending.parts[batchIndex]
		if !exists {
			return nil, false, nil
		}
		satellites = append(satellites, part...)
	}

	delete(a.batches, batch.BatchID)

	payload, err := json.Marshal(satellites)
	if err != nil {
		return nil, false, err
	}
	return payload, true, nil
}

func (sc *stateCache) set(msgType string, payload json.RawMessage) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	switch msgType {
	case "satellites":
		sc.satellites = payload
	case "conjunctions":
		sc.conjunctions = payload
	case "spaceWeather":
		sc.spaceWeather = payload
	}
}

func (sc *stateCache) sendAll(c *client) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	send := func(msgType string, payload json.RawMessage) {
		if payload == nil {
			return
		}
		msg := shared.WSMessage{Type: msgType, Payload: payload}
		data, err := json.Marshal(msg)
		if err != nil {
			return
		}
		select {
		case c.send <- data:
		default:
		}
	}

	send("satellites", sc.satellites)
	send("conjunctions", sc.conjunctions)
	send("spaceWeather", sc.spaceWeather)
}

// ── WebSocket handler ───────────────────────────────────────────────────────

func wsHandler(h *hub, cache *stateCache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws upgrade failed", "err", err)
			return
		}

		c := &client{
			conn: conn,
			send: make(chan []byte, 64),
		}

		h.register(c)
		slog.Info("ws client connected", "remote", r.RemoteAddr, "total", h.count())

		// Send connected message with serverTime
		connMsg := shared.WSMessage{
			Type:    "connected",
			Payload: json.RawMessage(fmt.Sprintf(`{"message":"connected to aurora gateway","serverTime":"%s"}`, time.Now().UTC().Format(time.RFC3339))),
		}
		if data, err := json.Marshal(connMsg); err == nil {
			select {
			case c.send <- data:
			default:
			}
		}

		// Send cached state
		cache.sendAll(c)

		// Write pump
		go func() {
			defer func() {
				h.unregister(c)
				conn.Close()
				slog.Info("ws client disconnected", "remote", r.RemoteAddr, "total", h.count())
			}()

			// Ping ticker for keepalive
			pingTicker := time.NewTicker(30 * time.Second)
			defer pingTicker.Stop()

			for {
				select {
				case msg, ok := <-c.send:
					if !ok {
						conn.WriteMessage(websocket.CloseMessage, []byte{})
						return
					}
					conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
					if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
						return
					}
				case <-pingTicker.C:
					conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
					if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				}
			}
		}()

		// Read pump (just drain + handle pong)
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}
}

// ── Kafka consumer goroutines ───────────────────────────────────────────────

func consumeAndBroadcast(
	ctx context.Context,
	h *hub,
	cache *stateCache,
	brokers []string,
	topic string,
	msgType string,
	satelliteAssembler *satelliteBatchAssembler,
) {
	groupID := "aurora-gateway-" + strings.ReplaceAll(topic, ".", "-")
	consumer := shared.NewConsumer(brokers, topic, groupID)
	defer consumer.Close()

	slog.Info("kafka consumer started", "topic", topic, "group", groupID)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		data, err := consumer.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Warn("kafka read error", "topic", topic, "err", err)
			continue
		}

		kafkaMessagesConsumed.WithLabelValues(topic).Inc()

		payload := json.RawMessage(data)
		if topic == shared.TopicSatellitesPositions && satelliteAssembler != nil {
			assembledPayload, ready, err := satelliteAssembler.ingest(data)
			if err != nil {
				slog.Warn("satellite batch assembly failed", "err", err)
				continue
			}
			if !ready {
				continue
			}
			payload = assembledPayload
		}
		cache.set(msgType, payload)
		h.broadcast(msgType, payload)
	}
}

// ── Main ────────────────────────────────────────────────────────────────────

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	brokers := strings.Split(envOr("KAFKA_BROKERS", "localhost:9092"), ",")
	wsPort := envOr("WS_PORT", "8080")
	metricsPort := envOr("METRICS_PORT_GATEWAY", "2112")

	h := newHub()
	cache := &stateCache{}
	satelliteAssembler := newSatelliteBatchAssembler()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start Kafka consumers
	go consumeAndBroadcast(ctx, h, cache, brokers, shared.TopicSatellitesPositions, "satellites", satelliteAssembler)
	go consumeAndBroadcast(ctx, h, cache, brokers, shared.TopicConjunctionsAlerts, "conjunctions", nil)
	go consumeAndBroadcast(ctx, h, cache, brokers, shared.TopicSpaceWeatherProcessed, "spaceWeather", nil)

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

	// WebSocket server
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", wsHandler(h, cache))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	server := &http.Server{
		Addr:         ":" + wsPort,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Start WS server in background
	go func() {
		slog.Info("websocket server starting", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("ws server failed", "err", err)
		}
	}()

	slog.Info("aurora gateway running")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	sig := <-sigCh
	slog.Info("shutting down", "signal", sig)
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("ws server shutdown failed", "err", err)
	}

	slog.Info("aurora gateway stopped")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
