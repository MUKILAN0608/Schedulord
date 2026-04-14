package main

import (
	"os"
	"runtime"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"schedulord-go-engine/api"
	"schedulord-go-engine/internal/allocation"
	"schedulord-go-engine/internal/conflict"
	"schedulord-go-engine/internal/engine"
	"schedulord-go-engine/internal/handlers"
	"schedulord-go-engine/internal/learning"
	"schedulord-go-engine/internal/metrics"
	"schedulord-go-engine/internal/prediction"
	"schedulord-go-engine/internal/simulation"
	"schedulord-go-engine/pkg"
)

func main() {
	logger, err := pkg.NewLogger()
	if err != nil {
		panic(err)
	}
	defer func() { _ = logger.Sync() }()

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	metrics.MustRegister()

	workers := envInt("GO_ENGINE_WORKERS", max(2, runtime.NumCPU()/2))
	alloc := allocation.New()
	conf := conflict.New()
	predict := prediction.New()
	sim := simulation.New()
	learn := learning.New(predict)

	core := engine.New(workers, alloc, conf, predict, sim, learn)
	core.Start()

	h := &handlers.Handler{Engine: core}

	r := gin.New()
	r.Use(gin.Recovery())

	api.RegisterRoutes(r, h)

	port := os.Getenv("GO_ENGINE_PORT")
	if port == "" {
		port = "9090"
	}

	logger.Info("schedulord-go-engine starting", zap.String("port", port), zap.Int("workers", workers))
	if err := r.Run(":" + port); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}

func envInt(name string, def int) int {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
