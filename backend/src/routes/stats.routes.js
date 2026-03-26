const express = require("express");
const router = express.Router();
const statsController = require("../controllers/stats.controller");

/**
 * @openapi
 * /api/stats:
 *   get:
 *     summary: System Analytics
 *     description: Real-time data on trigger performance and system health.
 *     tags:
 *       - Analytics
 *     responses:
 *       200:
 *         description: Successfully retrieved analytics data.
 */
router.get("/", statsController.getSystemStats);

module.exports = router;
