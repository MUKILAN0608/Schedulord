package prediction

import (
	"sync"
	"time"
)

// Trend analysis (simple):
// - Keeps an in-memory EMA-like demand signal per resource type.
// - Updated via feedback hooks (from learning module).
type Engine struct {
	mu     sync.Mutex
	signal map[string]float64
	last   map[string]time.Time
}

func New() *Engine {
	return &Engine{
		signal: make(map[string]float64),
		last:   make(map[string]time.Time),
	}
}

func (p *Engine) Bump(resourceType string, amount float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	prev := p.signal[resourceType]
	alpha := 0.2
	p.signal[resourceType] = alpha*amount + (1.0-alpha)*prev
	p.last[resourceType] = time.Now()
}

func (p *Engine) Predict(resourceType string) map[string]interface{} {
	p.mu.Lock()
	defer p.mu.Unlock()
	return map[string]interface{}{
		"resourceType": resourceType,
		"demandSignal": p.signal[resourceType],
		"lastUpdated":  p.last[resourceType],
		"method":       "ema-lite",
	}
}

