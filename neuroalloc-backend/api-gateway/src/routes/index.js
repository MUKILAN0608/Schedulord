const express = require("express");
const authRoutes = require("./auth");
const usersRoutes = require("./users");
const resourcesRoutes = require("./resources");
const requestsRoutes = require("./requests");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/resources", resourcesRoutes);
router.use("/requests", requestsRoutes);

module.exports = router;

