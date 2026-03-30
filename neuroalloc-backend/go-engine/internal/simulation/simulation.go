package simulation

import (
	"math/rand"
	"time"
)

// Scenario simulation (key feature):
// - Evaluate multiple scenarios with randomized stress factors.
// - Returns comparative scores to help pick strategies.
// This is a minimal but extensible baseline.
type Engine struct {
	rng *rand.Rand
}

func New() *Engine {
	return &Engine{rng: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

func (s *Engine) Simulate(resourceType string) map[string]interface{} {
	scenarios := []map[string]interface{}{}
	base := s.rng.Float64()

	for i := 0; i < 5; i++ {
		stress := 0.5 + s.rng.Float64() // 0.5..1.5
		score := (1.0 - 0.2*float64(i)) * base / stress
		scenarios = append(scenarios, map[string]interface{}{
			"name":        "scenario-" + itoa(i+1),
			"stress":      stress,
			"score":       score,
			"assumptions": "randomized-stress-baseline",
		})
	}

	return map[string]interface{}{
		"resourceType": resourceType,
		"scenarios":    scenarios,
		"generatedAt":  time.Now(),
	}
}

func itoa(v int) string {
	if v == 0 {
		return "0"
	}
	b := make([]byte, 0, 12)
	n := v
	for n > 0 {
		d := n % 10
		b = append([]byte{byte('0' + d)}, b...)
		n /= 10
	}
	return string(b)
}

