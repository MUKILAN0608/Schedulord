package api

import (
	"github.com/gin-gonic/gin"
	"schedulord-go-engine/internal/handlers"
)

func RegisterRoutes(r *gin.Engine, h *handlers.Handler) {
	r.GET("/healthz", h.Healthz)
	r.POST("/process", h.Process)
	r.GET("/predict", h.Predict)
	r.GET("/simulate", h.Simulate)
	r.GET("/learning/stats", h.LearningStats)
	r.GET("/metrics", h.Metrics)
}
