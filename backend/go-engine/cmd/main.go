package main

import (
	"context"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"syscall"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"schedulord-go-engine/api"
	"schedulord-go-engine/internal/allocation"
	"schedulord-go-engine/internal/conflict"
	"schedulord-go-engine/internal/engine"
	"schedulord-go-engine/internal/handlers"
	kafkaConsumer "schedulord-go-engine/internal/kafka"
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

	// Start Kafka consumer in background goroutine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		logger.Fatal("FATAL: KAFKA_BROKERS not set. Kafka is strictly required for execution. Exiting.")
	}

	consumer := kafkaConsumer.NewConsumer(core, logger)
	go func() {
		logger.Info("Starting Kafka consumer goroutine")
		consumer.Start(ctx)
	}()
	logger.Info("Kafka consumer goroutine launched", zap.String("brokers", kafkaBrokers))

	h := &handlers.Handler{Engine: core}

	r := gin.New()
	r.Use(gin.Recovery())

	api.RegisterRoutes(r, h)

	port := os.Getenv("GO_ENGINE_PORT")
	if port == "" {
		port = "9090"
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		logger.Info("Shutdown signal received")
		cancel()
		core.Stop()
	}()

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
