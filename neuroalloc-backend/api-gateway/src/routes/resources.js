const express = require("express");
const Joi = require("joi");
const { authenticateJWT, requireRole } = require("../middleware/auth");
const {
  listResources,
  createResource,
  getResource,
  updateResource,
  deleteResource,
} = require("../controllers/resourcesController");

const router = express.Router();

router.get("/", authenticateJWT, listResources);
router.get("/:id", authenticateJWT, getResource);

const createSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  type: Joi.string().min(1).max(200).required(),
  capacity: Joi.number().min(0).required(),
  metadata: Joi.object().default({}),
  isAvailable: Joi.boolean().default(true),
});

router.post("/", authenticateJWT, requireRole("admin"), async (req, res, next) => {
  try {
    req.body = await createSchema.validateAsync(req.body, { abortEarly: false });
    return createResource(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

const patchSchema = Joi.object({
  name: Joi.string().min(1).max(200),
  type: Joi.string().min(1).max(200),
  capacity: Joi.number().min(0),
  metadata: Joi.object(),
  isAvailable: Joi.boolean(),
}).min(1);

router.patch("/:id", authenticateJWT, requireRole("admin"), async (req, res, next) => {
  try {
    req.body = await patchSchema.validateAsync(req.body, { abortEarly: false });
    return updateResource(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

router.delete("/:id", authenticateJWT, requireRole("admin"), deleteResource);

module.exports = router;

