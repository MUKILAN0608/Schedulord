package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	RequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "go_engine_requests_total",
			Help: "Total number of Go engine requests",
		},
		[]string{"route", "status"},
	)

	ProcessDurationSeconds = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "go_engine_process_duration_seconds",
			Help:    "Time spent processing /process",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5},
		},
	)

	AllocationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "go_engine_allocations_total",
			Help: "Total allocation decisions by strategy",
		},
		[]string{"strategy", "status"},
	)

	ConflictsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "go_engine_conflicts_total",
			Help: "Total resource conflicts detected",
		},
	)
)

func MustRegister() {
	prometheus.MustRegister(RequestsTotal, ProcessDurationSeconds, AllocationsTotal, ConflictsTotal)
}

func ObserveProcessDuration(start time.Time) {
	ProcessDurationSeconds.Observe(time.Since(start).Seconds())
}
