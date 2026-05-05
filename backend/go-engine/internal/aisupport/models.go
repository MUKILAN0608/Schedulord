package aisupport

import "fmt"

// FeasibilityModel estimates probability a request can be served now.
type FeasibilityModel interface {
	Predict(Input) float64
}

// LoadModel forecasts near-term system load.
type LoadModel interface {
	Predict(Input) float64
}

// PriorityModel computes business priority score.
type PriorityModel interface {
	Predict(Input) float64
}

// LogisticFeasibility is a compact custom logistic regression model.
type LogisticFeasibility struct {
	Bias                  float64
	WeightPriority        float64
	WeightSystemLoad      float64
	WeightAvailableRatio  float64
	WeightHistoricalScore float64
}

func NewLogisticFeasibility() *LogisticFeasibility {
	return &LogisticFeasibility{
		Bias:                  -0.8,
		WeightPriority:        0.9,
		WeightSystemLoad:      -1.6,
		WeightAvailableRatio:  1.4,
		WeightHistoricalScore: 0.8,
	}
}

func (m *LogisticFeasibility) Predict(in Input) float64 {
	availableRatio := 0.0
	if in.TotalResources > 0 {
		availableRatio = float64(in.AvailableResources) / float64(in.TotalResources)
	}
	normPriority := float64(in.Priority) / 100.0
	z := m.Bias +
		m.WeightPriority*normPriority +
		m.WeightSystemLoad*in.SystemLoad +
		m.WeightAvailableRatio*availableRatio +
		m.WeightHistoricalScore*in.HistoricalSuccess
	return clamp01(sigmoid(z))
}

// TreeLoadPredictor is a deterministic decision-tree style predictor.
// It keeps inference cost extremely low under high concurrency.
type TreeLoadPredictor struct{}

func NewTreeLoadPredictor() *TreeLoadPredictor { return &TreeLoadPredictor{} }

func (m *TreeLoadPredictor) Predict(in Input) float64 {
	if in.SystemLoad > 0.85 {
		if in.Quantity > 8 {
			return 0.95
		}
		return 0.88
	}
	if in.SystemLoad > 0.65 {
		if in.Priority > 70 {
			return 0.72
		}
		return 0.78
	}
	if in.SystemLoad > 0.40 {
		return 0.55
	}
	return 0.35
}

// GorgoniaPriorityScorer is an inference abstraction for NN priority scoring.
// It is currently implemented with a tiny feed-forward approximation and can be
// swapped with a full Gorgonia-backed runtime without changing the caller API.
type GorgoniaPriorityScorer struct{}

func NewGorgoniaPriorityScorer() *GorgoniaPriorityScorer { return &GorgoniaPriorityScorer{} }

func (m *GorgoniaPriorityScorer) Predict(in Input) float64 {
	normPriority := float64(in.Priority) / 100.0
	normQty := float64(in.Quantity) / 10.0
	roleBoost := 0.0
	if in.UserRole == "admin" {
		roleBoost = 0.15
	}
	// 2-layer compact neural approximation.
	h1 := sigmoid(0.6*normPriority + 0.4*normQty + roleBoost - 0.25*in.SystemLoad)
	h2 := sigmoid(0.7*h1 + 0.2*in.HistoricalSuccess - 0.1)
	return clamp01(h2)
}

// Pipeline composes the three AI support steps.
type Pipeline struct {
	feasibility FeasibilityModel
	load        LoadModel
	priority    PriorityModel
	modelSource string
}

func (p *Pipeline) Evaluate(in Input) Output {
	feas := p.feasibility.Predict(in)
	load := p.load.Predict(in)
	priority := p.priority.Predict(in)

	return Output{
		FeasibilityScore: feas,
		PredictedLoad:    load,
		PriorityScore:    priority,
		DecisionLog: []string{
			fmt.Sprintf("model_source=%s", p.modelSource),
			fmt.Sprintf("logistic feasibility=%.3f", feas),
			fmt.Sprintf("tree load prediction=%.3f", load),
			fmt.Sprintf("neural priority score=%.3f", priority),
		},
	}
}
