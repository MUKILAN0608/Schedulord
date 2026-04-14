const express = require("express");
const Joi = require("joi");
const { authenticateJWT, requireRole } = require("../middleware/auth");
const {
  listRequests,
  createRequest,
  getRequest,
  cancelRequest,
  runAllocationNow,
} = require("../controllers/requestsController");

const router = express.Router();

router.get("/", authenticateJWT, listRequests);
router.get("/:id", authenticateJWT, getRequest);

const createSchema = Joi.object({
  resourceType: Joi.string().min(1).max(200).required(),
  quantity: Joi.number().integer().min(1).required(),
  priority: Joi.number().integer().min(0).max(100).default(0),
});

router.post("/", authenticateJWT, async (req, res, next) => {
  try {
    req.body = await createSchema.validateAsync(req.body, { abortEarly: false });
    return createRequest(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

router.post("/:id/cancel", authenticateJWT, cancelRequest);

// Admin-only "run decision now" (Node → Go) for manual allocation.
router.post("/:id/allocate", authenticateJWT, requireRole("admin"), runAllocationNow);

module.exports = router;
