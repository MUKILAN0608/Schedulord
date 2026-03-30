package allocation

import (
	"math"
	"sort"

	"neuroalloc-go-engine/internal/models"
)

// Priority scoring:
// - Prefer available resources matching request type
// - Prefer higher capacity for larger quantity requests
// - Boost by request priority
type Engine struct{}

func New() *Engine { return &Engine{} }

func (a *Engine) Decide(payload models.ProcessPayload) models.ProcessResult {
	req := payload.Request

	candidates := make([]models.Resource, 0, len(payload.Resources))
	for _, r := range payload.Resources {
		if !r.IsAvailable {
			continue
		}
		if r.Type != req.ResourceType {
			continue
		}
		candidates = append(candidates, r)
	}

	if len(candidates) == 0 {
		return models.ProcessResult{
			Allocation: models.Allocation{
				ResourceID: "",
				Score:      0,
				Reason:     "no matching available resources",
				Details: map[string]interface{}{
					"resourceType": req.ResourceType,
				},
			},
		}
	}

	type scored struct {
		r     models.Resource
		score float64
	}
	scoredList := make([]scored, 0, len(candidates))

	for _, r := range candidates {
		quantityFit := float64(min(r.Capacity, req.Quantity)) / float64(max(1, req.Quantity))
		priorityBoost := float64(req.Priority) / 100.0
		capacityBonus := math.Log1p(float64(r.Capacity)) / 10.0
		score := 0.6*quantityFit + 0.3*priorityBoost + 0.1*capacityBonus
		scoredList = append(scoredList, scored{r: r, score: score})
	}

	sort.Slice(scoredList, func(i, j int) bool { return scoredList[i].score > scoredList[j].score })
	best := scoredList[0]

	return models.ProcessResult{
		Allocation: models.Allocation{
			ResourceID: best.r.ID,
			Score:      best.score,
			Details: map[string]interface{}{
				"matchedType": req.ResourceType,
				"capacity":    best.r.Capacity,
				"quantity":    req.Quantity,
				"priority":    req.Priority,
			},
		},
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

