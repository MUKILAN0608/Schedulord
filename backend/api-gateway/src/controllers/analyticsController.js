const Request = require("../models/Request");
const Resource = require("../models/Resource");
const Allocation = require("../models/Allocation");
const SystemEvent = require("../models/SystemEvent");
const { getPrediction, runSimulation } = require("../services/goClient");
const { cacheGet, cacheSet } = require("../config/redis");
const mongoose = require("mongoose");

// Dashboard overview stats
async function getDashboardStats(req, res, next) {
  try {
    const cacheKey = `analytics:dashboard:${req.user.sub}`;
    
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let userFilter = {};
    if (req.user.role !== 'admin') {
      userFilter = { userId: req.user.sub };
    }

    const [
      totalResources,
      availableResources,
      totalRequests,
      pendingRequests,
      allocatedRequests,
      rejectedRequests,
      recentEvents,
      totalAllocations
    ] = await Promise.all([
      Resource.countDocuments(),
      Resource.countDocuments({ isAvailable: true }),
      Request.countDocuments(userFilter),
      Request.countDocuments({ ...userFilter, status: "pending" }),
      Request.countDocuments({ ...userFilter, status: "allocated" }),
      Request.countDocuments({ ...userFilter, status: "rejected" }),
      SystemEvent.find(userFilter).sort({ createdAt: -1 }).limit(20).lean(),
      Request.countDocuments({ ...userFilter, status: "allocated" }), // Allocations matching user
    ]);

    const stats = {
      resources: { 
        total: totalResources, 
        available: availableResources, 
        utilization: totalResources > 0 ? ((totalResources - availableResources) / totalResources * 100).toFixed(1) : 0 
      },
      requests: { 
        total: totalRequests, 
        pending: pendingRequests, 
        allocated: allocatedRequests, 
        rejected: rejectedRequests 
      },
      allocations: { total: totalAllocations },
      recentEvents,
    };

    await cacheSet(cacheKey, stats, 10);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

// Resource utilization breakdown
async function getResourceUtilization(req, res, next) {
  try {
    const resources = await Resource.find().lean();
    const allocations = await Allocation.find().populate("requestId").lean();

    const utilMap = {};
    for (const r of resources) {
      const rType = r.type;
      if (!utilMap[rType]) {
        utilMap[rType] = { type: rType, total: 0, available: 0, allocated: 0, totalCapacity: 0, usedCapacity: 0 };
      }
      utilMap[rType].total++;
      utilMap[rType].totalCapacity += r.capacity;
      if (r.isAvailable) utilMap[rType].available++;
    }

    for (const a of allocations) {
      const resource = resources.find(r => String(r._id) === String(a.resourceId));
      if (resource) {
        const rType = resource.type;
        if (utilMap[rType]) {
          utilMap[rType].allocated++;
          utilMap[rType].usedCapacity += a.requestId?.quantity || 0;
        }
      }
    }

    res.json({ utilization: Object.values(utilMap) });
  } catch (err) {
    next(err);
  }
}

// Demand trends over time (last 7 days, grouped by hour)
async function getDemandTrends(req, res, next) {
  try {
    const cacheKey = `analytics:demand-trends:${req.user.sub}`;
    
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const matchStage = { 
      createdAt: { $gte: sevenDaysAgo }
    };
    if (req.user.role !== 'admin') {
      matchStage.userId = new mongoose.Types.ObjectId(req.user.sub);
    }

    const trends = await Request.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            hour: { $hour: "$createdAt" },
            type: "$resourceType",
          },
          count: { $sum: 1 },
          avgPriority: { $avg: "$priority" },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.date": 1, "_id.hour": 1 } },
    ]);

    const result = { trends, generatedAt: new Date() };
    await cacheSet(cacheKey, result, 60);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Allocation performance metrics
async function getAllocationMetrics(req, res, next) {
  try {
    let requestFilter = {};
    if (req.user.role !== 'admin') {
      requestFilter = { userId: req.user.sub };
    }
    const userRequests = await Request.find(requestFilter, '_id').lean();
    const requestIds = userRequests.map(r => r._id);

    const allocations = await Allocation.find({ requestId: { $in: requestIds } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const scores = allocations.map(a => a.score).filter(Boolean);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const confidences = allocations.map(a => a.confidence).filter(Boolean);
    const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

    const byStrategy = {};
    for (const a of allocations) {
      const s = a.strategy || "immediate";
      if (!byStrategy[s]) byStrategy[s] = { count: 0, totalScore: 0 };
      byStrategy[s].count++;
      byStrategy[s].totalScore += a.score || 0;
    }

    res.json({
      totalAllocations: allocations.length,
      averageScore: avgScore,
      averageConfidence: avgConfidence,
      byStrategy,
      recent: allocations.slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
}

// System events feed
async function getSystemEvents(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const type = req.query.type;
    
    let filter = {};
    if (req.user.role !== 'admin') {
      filter.userId = req.user.sub;
    }
    if (type) filter.type = type;

    const events = await SystemEvent.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ events });
  } catch (err) {
    next(err);
  }
}

// Prediction proxy to Go engine
async function getPredictionData(req, res, next) {
  try {
    const resourceType = req.query.resourceType || "all";
    const data = await getPrediction(`?resourceType=${resourceType}`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// Simulation proxy to Go engine
async function getSimulationData(req, res, next) {
  try {
    const resourceType = req.query.resourceType || "all";
    const data = await runSimulation(`?resourceType=${resourceType}`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
  getResourceUtilization,
  getDemandTrends,
  getAllocationMetrics,
  getSystemEvents,
  getPredictionData,
  getSimulationData,
};
