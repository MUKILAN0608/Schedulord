package prediction

import (
	"sync"
	"time"
)

// Trend analysis:
// - Keeps an in-memory EMA-like demand signal per resource type.
// - Updated via feedback hooks (from learning module).
// - Predicts demand spikes by analyzing signal velocity.
type Engine struct {
	mu     sync.Mutex
	signal map[string]float64
	last   map[string]time.Time
	history map[string][]dataPoint
}

type dataPoint struct {
	value float64
	at    time.Time
}

func New() *Engine {
	return &Engine{
		signal:  make(map[string]float64),
		last:    make(map[string]time.Time),
		history: make(map[string][]dataPoint),
	}
}

func (p *Engine) Bump(resourceType string, amount float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	prev := p.signal[resourceType]
	alpha := 0.2
	p.signal[resourceType] = alpha*amount + (1.0-alpha)*prev
	p.last[resourceType] = time.Now()

	// Keep last 100 data points for trend analysis
	p.history[resourceType] = append(p.history[resourceType], dataPoint{
		value: p.signal[resourceType],
		at:    time.Now(),
	})
	if len(p.history[resourceType]) > 100 {
		p.history[resourceType] = p.history[resourceType][1:]
	}
}

func (p *Engine) Predict(resourceType string) map[string]interface{} {
	p.mu.Lock()
	defer p.mu.Unlock()

	demand := p.signal[resourceType]
	lastUpdate := p.last[resourceType]

	// Calculate trend velocity
	trend := "stable"
	velocity := 0.0
	history := p.history[resourceType]
	if len(history) >= 5 {
		recent := history[len(history)-5:]
		first := recent[0].value
		last := recent[len(recent)-1].value
		velocity = last - first
		if velocity > 0.1 {
			trend = "increasing"
		} else if velocity < -0.1 {
			trend = "decreasing"
		}
	}

	// Predict spike
	spikeProbability := 0.0
	if velocity > 0.2 {
		spikeProbability = 0.3 + velocity*0.5
		if spikeProbability > 1.0 {
			spikeProbability = 1.0
		}
	}

	return map[string]interface{}{
		"resourceType":    resourceType,
		"demandSignal":    demand,
		"trend":           trend,
		"velocity":        velocity,
		"spikeProbability": spikeProbability,
		"dataPoints":      len(history),
		"lastUpdated":     lastUpdate,
		"method":          "ema-with-trend",
	}
}
