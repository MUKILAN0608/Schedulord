package kafka

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
	"schedulord-go-engine/internal/engine"
	"schedulord-go-engine/internal/models"
)

const (
	TopicRequests = "schedulord.allocation.requests"
	TopicResults  = "schedulord.allocation.results"
)

// KafkaMessage represents the incoming Kafka event from the Node API gateway.
type KafkaMessage struct {
	Type         string            `json:"type"`
	RequestID    string            `json:"requestId"`
	UserID       string            `json:"userId"`
	ResourceType string            `json:"resourceType"`
	Quantity     int               `json:"quantity"`
	Priority     int               `json:"priority"`
	Resources    []models.Resource `json:"resources"`
	Timestamp    string            `json:"timestamp"`
}

// ResultMessage is published to the results topic after processing.
type ResultMessage struct {
	Type       string              `json:"type"`
	RequestID  string              `json:"requestId"`
	UserID     string              `json:"userId"`
	Allocation models.Allocation   `json:"allocation"`
	Simulation map[string]interface{} `json:"simulation,omitempty"`
	Prediction map[string]interface{} `json:"prediction,omitempty"`
	ProcessedAt string             `json:"processedAt"`
}

// Consumer reads allocation requests from Kafka and processes them through the engine.
type Consumer struct {
	reader *kafka.Reader
	writer *kafka.Writer
	eng    *engine.Engine
	logger *zap.Logger
}

func brokers() []string {
	b := os.Getenv("KAFKA_BROKERS")
	if b == "" {
		b = "localhost:9092"
	}
	return strings.Split(b, ",")
}

// NewConsumer creates a Kafka consumer + producer pair.
func NewConsumer(eng *engine.Engine, logger *zap.Logger) *Consumer {
	bs := brokers()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        bs,
		Topic:          TopicRequests,
		GroupID:        "schedulord-go-engine",
		MinBytes:       1,
		MaxBytes:       10e6, // 10MB
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
		MaxWait:        500 * time.Millisecond,
	})

	writer := &kafka.Writer{
		Addr:         kafka.TCP(bs...),
		Topic:        TopicResults,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
		RequiredAcks: kafka.RequireOne,
		Async:        false,
	}

	return &Consumer{
		reader: reader,
		writer: writer,
		eng:    eng,
		logger: logger,
	}
}

// Start begins consuming from Kafka in a blocking loop. Call from a goroutine.
func (c *Consumer) Start(ctx context.Context) {
	c.logger.Info("Kafka consumer starting", zap.String("topic", TopicRequests), zap.Strings("brokers", brokers()))

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Kafka consumer shutting down")
			_ = c.reader.Close()
			_ = c.writer.Close()
			return
		default:
		}

		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			c.logger.Warn("Kafka fetch error", zap.Error(err))
			time.Sleep(time.Second)
			continue
		}

		c.processMessage(ctx, msg)
	}
}

func (c *Consumer) processMessage(ctx context.Context, msg kafka.Message) {
	var incoming KafkaMessage
	if err := json.Unmarshal(msg.Value, &incoming); err != nil {
		c.logger.Error("Failed to unmarshal Kafka message", zap.Error(err))
		_ = c.reader.CommitMessages(ctx, msg)
		return
	}

	c.logger.Info("Processing Kafka event",
		zap.String("requestId", incoming.RequestID),
		zap.String("type", incoming.Type),
		zap.String("resourceType", incoming.ResourceType),
	)

	// Build the ProcessPayload for the engine
	payload := models.ProcessPayload{
		Request: models.Request{
			ID:           incoming.RequestID,
			ResourceType: incoming.ResourceType,
			Quantity:     incoming.Quantity,
			Priority:     incoming.Priority,
		},
		Resources: incoming.Resources,
	}

	// Process synchronously through the engine
	result, err := c.eng.ProcessSync(ctx, payload)
	if err != nil {
		c.logger.Error("Engine processing failed", zap.Error(err), zap.String("requestId", incoming.RequestID))
		_ = c.reader.CommitMessages(ctx, msg)
		return
	}

	// Publish result to results topic
	resultMsg := ResultMessage{
		Type:        "allocation.completed",
		RequestID:   incoming.RequestID,
		UserID:      incoming.UserID,
		Allocation:  result.Allocation,
		Simulation:  result.Simulation,
		Prediction:  result.Prediction,
		ProcessedAt: time.Now().UTC().Format(time.RFC3339),
	}

	resultBytes, err := json.Marshal(resultMsg)
	if err != nil {
		c.logger.Error("Failed to marshal result", zap.Error(err))
		_ = c.reader.CommitMessages(ctx, msg)
		return
	}

	err = c.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(incoming.RequestID),
		Value: resultBytes,
	})
	if err != nil {
		c.logger.Error("Failed to publish result to Kafka", zap.Error(err), zap.String("requestId", incoming.RequestID))
	} else {
		c.logger.Info("Published allocation result to Kafka",
			zap.String("requestId", incoming.RequestID),
			zap.String("resourceId", result.Allocation.ResourceID),
			zap.String("strategy", result.Allocation.Strategy),
		)
	}

	_ = c.reader.CommitMessages(ctx, msg)
}
