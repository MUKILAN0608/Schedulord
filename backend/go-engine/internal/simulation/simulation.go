package simulation

import "strings"

type Engine struct{}

func New() *Engine {
	return &Engine{}
}

func (e *Engine) Simulate(resourceType string) map[string]interface{} {
	rt := strings.ToLower(strings.TrimSpace(resourceType))
	if rt == "" {
		rt = "all"
	}

	scenarios := []map[string]interface{}{
		{
			"name":        "Balanced Routing",
			"strategy":    "balanced",
			"score":       0.82,
			"latency":     "42ms",
			"risk":        "low",
			"description": "Balances throughput and reliability across available clusters.",
		},
		{
			"name":        "Fast-Path Priority",
			"strategy":    "fast_path",
			"score":       0.76,
			"latency":     "29ms",
			"risk":        "medium",
			"description": "Optimizes immediate response time for urgent requests.",
		},
		{
			"name":        "Capacity Guard",
			"strategy":    "capacity_guard",
			"score":       0.70,
			"latency":     "51ms",
			"risk":        "low",
			"description": "Conserves resources and protects against sudden load spikes.",
		},
	}

	recommended := "balanced"
	if rt == "gpu" {
		recommended = "capacity_guard"
	}

	return map[string]interface{}{
		"resourceType":         rt,
		"scenarios":            scenarios,
		"recommendedStrategy":  recommended,
		"confidence":           0.81,
		"simulationDataSource": "deterministic-runtime",
	}
}
