package engine

import (
	"context"
	"time"

	"schedulord-go-engine/internal/models"
)

// Event-driven core: processes allocation, simulation, conflict resolution, and prediction.
// Workers consume from the queue concurrently and compute allocation decisions.
type Engine struct {
	in      chan models.ProcessPayload
	out     chan models.ProcessResult
	workers int
	stop    chan struct{}

	allocator  Allocator
	conflicts  ConflictResolver
	learning   Learner
	predictor  Predictor
	simulator  Simulator
}

type Allocator interface {
	Decide(payload models.ProcessPayload) models.ProcessResult
}

type ConflictResolver interface {
	Resolve(result models.ProcessResult) models.ProcessResult
}

type Predictor interface {
	Predict(resourceType string) map[string]interface{}
}

type Simulator interface {
	Simulate(resourceType string) map[string]interface{}
}

type Learner interface {
	Feedback(result models.ProcessResult, accepted bool)
	Stats() map[string]interface{}
}

func New(workers int, allocator Allocator, conflicts ConflictResolver, predictor Predictor, simulator Simulator, learner Learner) *Engine {
	if workers < 1 {
		workers = 1
	}
	return &Engine{
		in:        make(chan models.ProcessPayload, 1024),
		out:       make(chan models.ProcessResult, 1024),
		workers:   workers,
		stop:      make(chan struct{}),
		allocator: allocator,
		conflicts: conflicts,
		predictor: predictor,
		simulator: simulator,
		learning:  learner,
	}
}

func (e *Engine) Start() {
	for i := 0; i < e.workers; i++ {
		go e.worker()
	}
}

func (e *Engine) worker() {
	for {
		select {
		case <-e.stop:
			return
		case payload := <-e.in:
			// Allocation decision
			result := e.allocator.Decide(payload)
			// Conflict resolution layer
			result = e.conflicts.Resolve(result)
			// Enrich with simulation data
			result.Simulation = e.simulator.Simulate(payload.Request.ResourceType)
			// Enrich with prediction data
			result.Prediction = e.predictor.Predict(payload.Request.ResourceType)
			// Feed learning module
			e.learning.Feedback(result, result.Allocation.ResourceID != "")
			// Push result
			select {
			case e.out <- result:
			default:
				// Drop if under extreme load (backpressure)
			}
		}
	}
}

func (e *Engine) Stop() {
	close(e.stop)
}

// ProcessSync enqueues a payload and waits for one result.
func (e *Engine) ProcessSync(ctx context.Context, payload models.ProcessPayload) (models.ProcessResult, error) {
	select {
	case e.in <- payload:
	default:
		return models.ProcessResult{Allocation: models.Allocation{Reason: "engine overloaded"}}, context.DeadlineExceeded
	}

	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return models.ProcessResult{Allocation: models.Allocation{Reason: "request cancelled"}}, ctx.Err()
	case <-timer.C:
		return models.ProcessResult{Allocation: models.Allocation{Reason: "engine timeout"}}, context.DeadlineExceeded
	case result := <-e.out:
		return result, nil
	}
}

func (e *Engine) Predict(resourceType string) map[string]interface{} {
	return e.predictor.Predict(resourceType)
}

func (e *Engine) Simulate(resourceType string) map[string]interface{} {
	return e.simulator.Simulate(resourceType)
}

func (e *Engine) LearningStats() map[string]interface{} {
	return e.learning.Stats()
}
