const express = require("express");
const Joi = require("joi");
const { authenticateJWT, requireRole } = require("../middleware/auth");
const { listUsers, listAdmins, getMe, createUser, updateUser } = require("../controllers/usersController");

const router = express.Router();

router.get("/me", authenticateJWT, getMe);
router.get("/admins", authenticateJWT, listAdmins);

router.get("/", authenticateJWT, requireRole("admin"), listUsers);

const createSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(200).required(),
  role: Joi.string().valid("admin", "user").default("user"),
});

router.post("/", authenticateJWT, requireRole("admin"), async (req, res, next) => {
  try {
    req.body = await createSchema.validateAsync(req.body, { abortEarly: false });
    return createUser(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

const patchSchema = Joi.object({
  role: Joi.string().valid("admin", "user"),
  isActive: Joi.boolean(),
}).min(1);

router.patch("/:id", authenticateJWT, requireRole("admin"), async (req, res, next) => {
  try {
    req.body = await patchSchema.validateAsync(req.body, { abortEarly: false });
    return updateUser(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

module.exports = router;
