package learning

import (
	"sync"

	"schedulord-go-engine/internal/models"
	"schedulord-go-engine/internal/prediction"
)

// Adaptive learning module:
// - Updates prediction demand signal based on accepted/rejected outcomes.
// - Maintains in-memory success rate per resource ID for scoring adjustments.
// - Tracks overall system learning metrics.
type Module struct {
	mu           sync.Mutex
	resourceWins map[string]int
	resourceLoss map[string]int
	totalDecisions int
	totalAccepted  int

	predict *prediction.Engine
}

func New(predict *prediction.Engine) *Module {
	return &Module{
		resourceWins: make(map[string]int),
		resourceLoss: make(map[string]int),
		predict:      predict,
	}
}

func (l *Module) Feedback(result models.ProcessResult, accepted bool) {
	resID := result.Allocation.ResourceID
	if resID == "" {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	l.totalDecisions++
	if accepted {
		l.resourceWins[resID]++
		l.totalAccepted++
		l.predict.Bump("all", 1.0)

		// Bump specific resource type demand
		if rt, ok := result.Allocation.Details["matchedType"].(string); ok && rt != "" {
			l.predict.Bump(rt, 1.0)
		}
	} else {
		l.resourceLoss[resID]++
		l.predict.Bump("all", 0.2)
	}
}

func (l *Module) ResourceSuccessRate(resourceID string) float64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	w := l.resourceWins[resourceID]
	lo := l.resourceLoss[resourceID]
	total := w + lo
	if total == 0 {
		return 0.5
	}
	return float64(w) / float64(total)
}

func (l *Module) SystemAccuracy() float64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.totalDecisions == 0 {
		return 0.5
	}
	return float64(l.totalAccepted) / float64(l.totalDecisions)
}

func (l *Module) Stats() map[string]interface{} {
	l.mu.Lock()
	defer l.mu.Unlock()
	return map[string]interface{}{
		"totalDecisions": l.totalDecisions,
		"totalAccepted":  l.totalAccepted,
		"accuracy":       l.SystemAccuracy(),
		"resourceCount":  len(l.resourceWins) + len(l.resourceLoss),
	}
}
