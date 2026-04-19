const express = require("express");
const authRoutes = require("./auth");
const usersRoutes = require("./users");
const resourcesRoutes = require("./resources");
const requestsRoutes = require("./requests");
const analyticsRoutes = require("./analytics");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/resources", resourcesRoutes);
router.use("/requests", requestsRoutes);
router.use("/analytics", analyticsRoutes);

module.exports = router;
