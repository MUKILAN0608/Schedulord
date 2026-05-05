const express = require("express");
const Joi = require("joi");
const { register, login } = require("../controllers/authController");

const router = express.Router();

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email({ tlds: false }).required(),
  password: Joi.string().min(8).max(200).required(),
  role: Joi.string().valid("user").optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).required(),
  password: Joi.string().min(1).max(200).required(),
  intendedRole: Joi.string().valid("admin", "user").required(),
});

router.post("/register", async (req, res, next) => {
  try {
    await registerSchema.validateAsync(req.body, { abortEarly: false });
    return register(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    await loginSchema.validateAsync(req.body, { abortEarly: false });
    return login(req, res, next);
  } catch (err) {
    err.status = 400;
    return next(err);
  }
});

module.exports = router;
