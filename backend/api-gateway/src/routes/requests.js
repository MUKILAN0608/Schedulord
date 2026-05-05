const express = require("express");
const { z } = require("zod");
const { authenticateJWT, requireRole } = require("../middleware/auth");
const {
  listRequests,
  createRequest,
  getRequest,
  cancelRequest,
  runAllocationNow,
  approveRequest,
  rejectRequest,
  clearAllRequests,
  listMyAdminDecisions,
} = require("../controllers/requestsController");

const router = express.Router();

router.get("/", authenticateJWT, listRequests);
router.get("/decisions/me", authenticateJWT, requireRole("admin"), listMyAdminDecisions);
router.get("/:id", authenticateJWT, getRequest);

const createSchema = z.object({
  reviewerAdminId: z.string().regex(/^[a-fA-F0-9]{24}$/, "reviewerAdminId must be a valid ObjectId"),
  resourceType: z.string().min(1).max(200),
  preferredResourceId: z.string().regex(/^[a-fA-F0-9]{24}$/, "preferredResourceId must be a valid ObjectId").optional(),
  quantity: z.number().int().min(1),
  priority: z.number().int().min(0).max(100).default(0),
});

router.post("/", authenticateJWT, requireRole("user"), async (req, res, next) => {
  try {
    req.body = createSchema.parse(req.body);
    return createRequest(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

router.post("/:id/cancel", authenticateJWT, cancelRequest);

// Admin-only "run decision now" (Node → Go) for manual allocation.
router.post("/:id/allocate", authenticateJWT, requireRole("admin"), runAllocationNow);

// Admin approves → publishes an approved Kafka message for the Go engine to process.
router.post("/:id/approve", authenticateJWT, requireRole("admin"), approveRequest);

// Reviewer rejection (admin only).
router.post("/:id/reject", authenticateJWT, requireRole("admin"), rejectRequest);


// Admin-only: clear all requests (useful for fresh approval pipeline tests).
router.post("/clear", authenticateJWT, requireRole("admin"), clearAllRequests);

module.exports = router;
