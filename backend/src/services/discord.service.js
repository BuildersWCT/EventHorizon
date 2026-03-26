const axios = require("axios");

/**
 * Sends a notification to a Discord channel via a webhook URL.
 *
 * @param {string} url - The Discord Webhook URL.
 * @param {Object} payload - The message payload, supporting Embeds and custom formatting.
 * @returns {Promise<Object>} The API response data or a structured error.
 */
async function sendDiscordNotification(url, payload) {
  if (!url || !payload) {
    throw new Error("Discord Webhook URL and payload are required.");
  }

  try {
    const response = await axios.post(url, payload);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const { retry_after, message } = error.response.data;
      console.warn(
        `Discord Rate Limit: ${message || "Too many requests"}. Retry after ${retry_after}s`,
      );

      return {
        success: false,
        status: 429,
        retryAfter: retry_after,
        message: message || "Rate limited",
      };
    }

    console.error("Discord Service Error:", error.message);
    throw error;
  }
}

module.exports = {
  sendDiscordNotification,
};
