package aisupport

import (
	"math"
	"sort"

	"schedulord-go-engine/internal/models"
)

type RankedCandidate struct {
	Resource models.Resource
	Score    float64
}

// RankCandidates combines AI outputs with deterministic fit for final ordering.
func RankCandidates(in Input, ai Output, resources []models.Resource) []RankedCandidate {
	ranked := make([]RankedCandidate, 0, len(resources))
	for _, r := range resources {
		if !r.IsAvailable || r.Type != in.ResourceType {
			continue
		}
		quantityFit := float64(min(r.Capacity, in.Quantity)) / float64(max(1, in.Quantity))
		capacityBonus := math.Log1p(float64(r.Capacity)) / 10.0
		// Greedy utility: deterministic fit * AI confidence terms.
		score := (0.5*quantityFit + 0.3*ai.PriorityScore + 0.2*capacityBonus) *
			ai.FeasibilityScore * (1.0 - ai.PredictedLoad*0.5)

		ranked = append(ranked, RankedCandidate{Resource: r, Score: score})
	}

	sort.Slice(ranked, func(i, j int) bool { return ranked[i].Score > ranked[j].Score })
	return ranked
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
