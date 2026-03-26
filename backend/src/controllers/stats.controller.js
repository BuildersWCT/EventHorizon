const Trigger = require("../models/trigger.model");
const os = require("os");

/**
 * Get real-time data on trigger performance and system health.
 *
 * Exposes overall event aggregates, webhook status codes (mapped logically since historical codes are not saved),
 * and system resources.
 */
const getSystemStats = async (req, res, next) => {
  try {
    // 1. Aggregate stats for total events processed
    const eventsAggregation = await Trigger.aggregate([
      {
        $group: {
          _id: null,
          totalEvents: { $sum: "$totalExecutions" },
          failedEvents: { $sum: "$failedExecutions" },
        },
      },
    ]);

    const eventsData = eventsAggregation[0] || {
      totalEvents: 0,
      failedEvents: 0,
    };
    const successfulEvents = Math.max(
      0,
      eventsData.totalEvents - eventsData.failedEvents,
    );

    // 2. Breakdown of status codes for Webhook executions
    const webhookAggregation = await Trigger.aggregate([
      {
        $match: { actionType: "webhook" },
      },
      {
        $group: {
          _id: null,
          totalWebhook: { $sum: "$totalExecutions" },
          failedWebhook: { $sum: "$failedExecutions" },
        },
      },
    ]);

    const webhookData = webhookAggregation[0] || {
      totalWebhook: 0,
      failedWebhook: 0,
    };
    const successfulWebhook = Math.max(
      0,
      webhookData.totalWebhook - webhookData.failedWebhook,
    );

    // Status code breakdown logically mapped from success/failure records
    const webhookStatusCodes = {
      200: successfulWebhook,
      500: webhookData.failedWebhook,
    };

    // 3. System uptime and resource usage
    const systemHealth = {
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuLoad: os.loadavg(),
    };

    return res.json({
      eventsLog: {
        totalEvents: eventsData.totalEvents,
        failedEvents: eventsData.failedEvents,
        successfulEvents,
      },
      webhookStatusCodes,
      systemHealth,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSystemStats,
};
