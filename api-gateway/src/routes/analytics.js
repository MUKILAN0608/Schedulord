const express = require("express");
const { authenticateJWT, requireRole } = require("../middleware/auth");
const {
  getDashboardStats,
  getResourceUtilization,
  getDemandTrends,
  getAllocationMetrics,
  getSystemEvents,
  getPredictionData,
  getSimulationData,
} = require("../controllers/analyticsController");

const router = express.Router();

// Dashboard overview
router.get("/dashboard", authenticateJWT, getDashboardStats);

// Resource utilization breakdown
router.get("/utilization", authenticateJWT, getResourceUtilization);

// Demand trends (last 7 days)
router.get("/demand-trends", authenticateJWT, requireRole("admin"), getDemandTrends);

// Allocation performance
router.get("/allocations", authenticateJWT, getAllocationMetrics);

// System events feed
router.get("/events", authenticateJWT, getSystemEvents);

// Prediction data from Go engine
router.get("/predict", authenticateJWT, getPredictionData);

// Simulation data from Go engine
router.get("/simulate", authenticateJWT, getSimulationData);

module.exports = router;
