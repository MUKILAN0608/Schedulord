package learning

import (
	"sync"

	"neuroalloc-go-engine/internal/models"
	"neuroalloc-go-engine/internal/prediction"
)

// Feedback-based improvement (simple):
// - Update prediction demand signal based on accepted/rejected outcomes.
// - Maintain an in-memory "success rate" per resource id for slight scoring adjustments later.
type Module struct {
	mu           sync.Mutex
	resourceWins map[string]int
	resourceLoss map[string]int

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
	if accepted {
		l.resourceWins[resID]++
		l.predict.Bump("all", 1.0)
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

