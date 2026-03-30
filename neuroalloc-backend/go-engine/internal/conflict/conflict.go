package conflict

import (
	"sync"

	"neuroalloc-go-engine/internal/models"
)

// Queue-based conflict resolver:
// - If two allocations hit the same resource concurrently, we serialize by resource ID.
// - This is a simplified in-memory mechanism; in production you'd use a durable store/lock.
type Resolver struct {
	mu       sync.Mutex
	inflight map[string]struct{}
	queue    chan models.ProcessResult
}

func New() *Resolver {
	return &Resolver{
		inflight: make(map[string]struct{}),
		queue:    make(chan models.ProcessResult, 1024),
	}
}

func (r *Resolver) Resolve(result models.ProcessResult) models.ProcessResult {
	resID := result.Allocation.ResourceID
	if resID == "" {
		return result
	}

	r.mu.Lock()
	if _, ok := r.inflight[resID]; ok {
		// conflict: resource already being allocated "now"
		r.mu.Unlock()
		result.Allocation.ResourceID = ""
		result.Allocation.Reason = "conflict: resource busy"
		return result
	}
	r.inflight[resID] = struct{}{}
	r.mu.Unlock()

	// Release immediately (this is intentionally simple for phase-based build).
	r.mu.Lock()
	delete(r.inflight, resID)
	r.mu.Unlock()
	return result
}

