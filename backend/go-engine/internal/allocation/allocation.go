package allocation

import (
	"math"
	"sort"

	"schedulord-go-engine/internal/models"
)

// Priority scoring:
// - Prefer available resources matching request type
// - Prefer higher capacity for larger quantity requests
// - Boost by request priority
// - Compute confidence based on gap between best and second-best
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
				Confidence: 0,
				Strategy:   "none",
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

	// Compute confidence: how much better is the best vs second-best (0..1)
	confidence := 1.0
	if len(scoredList) > 1 {
		gap := best.score - scoredList[1].score
		confidence = math.Min(1.0, 0.5+gap*2.0)
	}

	// Collect alternatives (top 3 excluding best)
	var alternatives []models.AlternativeAlloc
	for i := 1; i < len(scoredList) && i <= 3; i++ {
		alternatives = append(alternatives, models.AlternativeAlloc{
			ResourceID: scoredList[i].r.ID,
			Score:      scoredList[i].score,
			Strategy:   "alternative",
		})
	}

	return models.ProcessResult{
		Allocation: models.Allocation{
			ResourceID: best.r.ID,
			Score:      best.score,
			Confidence: confidence,
			Strategy:   "immediate",
			Alternatives: alternatives,
			Details: map[string]interface{}{
				"matchedType":    req.ResourceType,
				"capacity":       best.r.Capacity,
				"quantity":       req.Quantity,
				"priority":       req.Priority,
				"candidateCount": len(candidates),
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
