package shared

import (
	"context"
	"log/slog"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/segmentio/kafka-go"
)

// Kafka topic constants.
const (
	TopicSatellitesTLE         = "aurora.satellites.tle"
	TopicSatellitesPositions   = "aurora.satellites.positions"
	TopicConjunctionsRaw       = "aurora.conjunctions.raw"
	TopicConjunctionsAlerts    = "aurora.conjunctions.alerts"
	TopicSpaceWeatherRaw       = "aurora.spaceweather.raw"
	TopicSpaceWeatherProcessed = "aurora.spaceweather.processed"
)

var (
	messagesProduced = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "aurora_kafka_messages_produced_total",
		Help: "Total Kafka messages produced",
	}, []string{"topic"})

	produceErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "aurora_kafka_produce_errors_total",
		Help: "Total Kafka produce errors",
	}, []string{"topic"})
)

// ── Producer ────────────────────────────────────────────────────────────────

type Producer struct {
	writer *kafka.Writer
	topic  string
}

func NewProducer(brokers []string, topic string) *Producer {
	w := &kafka.Writer{
		Addr:                   kafka.TCP(brokers...),
		Topic:                  topic,
		Balancer:               &kafka.LeastBytes{},
		BatchTimeout:           50 * time.Millisecond,
		RequiredAcks:           kafka.RequireOne,
		AllowAutoTopicCreation: true,
	}
	return &Producer{writer: w, topic: topic}
}

func (p *Producer) Publish(ctx context.Context, key string, value []byte) error {
	var err error
	for attempt := 1; attempt <= 5; attempt++ {
		err = p.writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(key),
			Value: value,
		})
		if err == nil {
			messagesProduced.WithLabelValues(p.topic).Inc()
			return nil
		}

		if ctx.Err() != nil || attempt == 5 {
			break
		}

		backoff := time.Duration(attempt*attempt) * 250 * time.Millisecond
		slog.Warn("kafka publish retry", "topic", p.topic, "key", key, "attempt", attempt, "backoff", backoff.String(), "err", err)

		timer := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			err = ctx.Err()
			attempt = 5
		case <-timer.C:
		}
	}

	produceErrors.WithLabelValues(p.topic).Inc()
	slog.Error("kafka publish failed", "topic", p.topic, "key", key, "err", err)
	return err
}

func (p *Producer) Close() error {
	return p.writer.Close()
}

// ── Consumer ────────────────────────────────────────────────────────────────

type Consumer struct {
	reader *kafka.Reader
	topic  string
}

func NewConsumer(brokers []string, topic string, groupID string) *Consumer {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          topic,
		GroupID:        groupID,
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.FirstOffset,
	})
	return &Consumer{reader: r, topic: topic}
}

func (c *Consumer) ReadMessage(ctx context.Context) ([]byte, error) {
	msg, err := c.reader.ReadMessage(ctx)
	if err != nil {
		return nil, err
	}
	return msg.Value, nil
}

func (c *Consumer) Close() error {
	return c.reader.Close()
}
