package main

import (
	"context"
	"os"
	"os/signal"
	"path/filepath"
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

	datasetPath, ok := resolveDatasetPath()
	if !ok {
		logger.Fatal("AI strict mode: training dataset not found (schedulord_research_dataset_12000.csv)")
	}
	if err := os.Setenv("AI_DATASET_PATH", datasetPath); err != nil {
		logger.Fatal("failed to set AI_DATASET_PATH", zap.Error(err))
	}
	logger.Info("AI dataset resolved for training", zap.String("datasetPath", datasetPath))

	workers := envInt("GO_ENGINE_WORKERS", max(2, runtime.NumCPU()/2))
	alloc := allocation.New()
	conf := conflict.New()
	predict := prediction.New()
	if err := predict.WarmStartFromCSV(datasetPath); err != nil {
		logger.Warn("prediction warm-start failed", zap.String("datasetPath", datasetPath), zap.Error(err))
	} else {
		logger.Info("prediction warm-start completed", zap.String("datasetPath", datasetPath))
	}
	sim := simulation.New()
	learn := learning.New(predict)

	core := engine.New(workers, alloc, conf, predict, sim, learn)
	core.Start()

	// Start Kafka consumer in background goroutine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		logger.Warn("KAFKA_BROKERS is not set; starting Go engine in HTTP-only mode without Kafka consumer")
	} else {
		consumer := kafkaConsumer.NewConsumer(core, logger)
		go func() {
			logger.Info("Starting Kafka consumer goroutine")
			consumer.Start(ctx)
		}()
		logger.Info("Kafka consumer goroutine launched", zap.String("brokers", kafkaBrokers))
	}

	h := &handlers.Handler{Engine: core}

	r := gin.New()
	r.Use(gin.Recovery())

	api.RegisterRoutes(r, h)

	port := os.Getenv("GO_ENGINE_PORT")
	if port == "" {
		// Default to 9095 for local direct gateway integration.
		port = "9095"
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

func resolveDatasetPath() (string, bool) {
	candidates := []string{}
	if p := os.Getenv("AI_DATASET_PATH"); p != "" {
		candidates = append(candidates, p)
	}
	candidates = append(candidates,
		filepath.Join(".", "schedulord_research_dataset_12000.csv"),
		filepath.Join("..", "schedulord_research_dataset_12000.csv"),
		filepath.Join("..", "..", "schedulord_research_dataset_12000.csv"),
		filepath.Join("/src", "schedulord_research_dataset_12000.csv"),
	)
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
	}
	return "", false
}
