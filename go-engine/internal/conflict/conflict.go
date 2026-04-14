package conflict

import (
	"sync"

	"schedulord-go-engine/internal/models"
)

// Queue-based conflict resolver:
// - If two allocations hit the same resource concurrently, we serialize by resource ID.
// - Track conflict count for metrics and system visibility.
type Resolver struct {
	mu           sync.Mutex
	inflight     map[string]struct{}
	conflictHits int
}

func New() *Resolver {
	return &Resolver{
		inflight: make(map[string]struct{}),
	}
}

func (r *Resolver) Resolve(result models.ProcessResult) models.ProcessResult {
	resID := result.Allocation.ResourceID
	if resID == "" {
		return result
	}

	r.mu.Lock()
	if _, ok := r.inflight[resID]; ok {
		// Conflict: resource already being allocated "now"
		r.conflictHits++
		r.mu.Unlock()

		// Try to fall back to an alternative
		if len(result.Allocation.Alternatives) > 0 {
			alt := result.Allocation.Alternatives[0]
			result.Allocation.ResourceID = alt.ResourceID
			result.Allocation.Score = alt.Score
			result.Allocation.Strategy = "conflict-fallback"
			result.Allocation.Reason = "conflict resolved using alternative resource"
			result.Allocation.Alternatives = result.Allocation.Alternatives[1:]
			return result
		}

		result.Allocation.ResourceID = ""
		result.Allocation.Reason = "conflict: resource busy, no alternatives"
		result.Allocation.Strategy = "conflict-rejected"
		return result
	}
	r.inflight[resID] = struct{}{}
	r.mu.Unlock()

	// Release after processing
	r.mu.Lock()
	delete(r.inflight, resID)
	r.mu.Unlock()
	return result
}

func (r *Resolver) ConflictCount() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.conflictHits
}
