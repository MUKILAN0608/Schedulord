package aisupport

import (
	"math"
	"time"

	"schedulord-go-engine/internal/models"
)

// Input is the unified feature payload used by the AI support layer.
// It is intentionally compact and fully Go-native for low-latency inference.
type Input struct {
	ResourceType       string
	Priority           int
	Quantity           int
	UserRole           string
	RequestTimestamp   time.Time
	QueueLength        int
	AvailableResources int
	TotalResources     int
	SystemLoad         float64 // 0..1
	HistoricalSuccess  float64 // 0..1
}

// Output is returned by the AI support layer and consumed by deterministic logic.
type Output struct {
	FeasibilityScore float64 // logistic regression output (0..1)
	PredictedLoad    float64 // decision tree / RF style estimate (0..1)
	PriorityScore    float64 // neural score (0..1)
	DecisionLog      []string
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

func sigmoid(x float64) float64 {
	return 1.0 / (1.0 + math.Exp(-x))
}

// BuildInput extracts a lightweight feature vector from the runtime payload.
func BuildInput(payload models.ProcessPayload) Input {
	total := len(payload.Resources)
	available := 0
	totalCap := 0
	availableCap := 0
	for _, r := range payload.Resources {
		totalCap += r.Capacity
		if r.IsAvailable {
			available++
			availableCap += r.Capacity
		}
	}

	usedRatio := 0.0
	if totalCap > 0 {
		usedRatio = 1.0 - float64(availableCap)/float64(totalCap)
	}

	ts := time.Now().UTC()
	if payload.Request.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, payload.Request.Timestamp); err == nil {
			ts = parsed
		}
	}

	return Input{
		ResourceType:       payload.Request.ResourceType,
		Priority:           payload.Request.Priority,
		Quantity:           payload.Request.Quantity,
		UserRole:           payload.Request.UserRole,
		RequestTimestamp:   ts,
		QueueLength:        payload.Request.QueueLength,
		AvailableResources: available,
		TotalResources:     total,
		SystemLoad:         clamp01(usedRatio),
		// Placeholder rolling metric; can be fed from persisted history later.
		HistoricalSuccess: 0.75,
	}
}
