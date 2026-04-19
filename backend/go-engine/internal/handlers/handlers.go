package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"schedulord-go-engine/internal/engine"
	"schedulord-go-engine/internal/metrics"
	"schedulord-go-engine/internal/models"
)

type Handler struct {
	Engine *engine.Engine
}

func (h *Handler) Healthz(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"ok": true, "service": "schedulord-go-engine"})
}

func (h *Handler) Metrics(c *gin.Context) {
	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}

func (h *Handler) Process(c *gin.Context) {
	start := time.Now()
	defer metrics.ObserveProcessDuration(start)

	var payload models.ProcessPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		metrics.RequestsTotal.WithLabelValues("/process", "400").Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid payload"}})
		return
	}

	result, err := h.Engine.ProcessSync(c.Request.Context(), payload)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("/process", "503").Inc()
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": gin.H{"message": "engine busy", "code": "ENGINE_BUSY"}})
		return
	}

	metrics.RequestsTotal.WithLabelValues("/process", "200").Inc()
	c.JSON(http.StatusOK, result)
}

func (h *Handler) Predict(c *gin.Context) {
	resourceType := c.Query("resourceType")
	if resourceType == "" {
		resourceType = "all"
	}
	metrics.RequestsTotal.WithLabelValues("/predict", "200").Inc()
	c.JSON(http.StatusOK, h.Engine.Predict(resourceType))
}

func (h *Handler) Simulate(c *gin.Context) {
	resourceType := c.Query("resourceType")
	if resourceType == "" {
		resourceType = "all"
	}
	metrics.RequestsTotal.WithLabelValues("/simulate", "200").Inc()
	c.JSON(http.StatusOK, h.Engine.Simulate(resourceType))
}

func (h *Handler) LearningStats(c *gin.Context) {
	metrics.RequestsTotal.WithLabelValues("/learning/stats", "200").Inc()
	c.JSON(http.StatusOK, h.Engine.LearningStats())
}
