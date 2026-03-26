const axios = require('axios');
const logger = require('../config/logger');

/**
 * Service to handle Telegram Bot notifications
 */
class TelegramService {
    /**
     * Sends a message to a Telegram chat via the Telegram Bot API.
     * 
     * @param {string} botToken - The Telegram Bot Token.
     * @param {string|number} chatId - The target Telegram Chat ID.
     * @param {string} text - The message text to send.
     * @returns {Promise<Object>} The API response data.
     */
    async sendTelegramMessage(botToken, chatId, text) {
        if (!botToken || !chatId || !text) {
            const error = 'Telegram Bot Token, Chat ID, and message text are required.';
            logger.error('Invalid Telegram message parameters', {
                hasToken: !!botToken,
                hasChatId: !!chatId,
                hasText: !!text,
                service: 'telegram'
            });
            throw new Error(error);
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        logger.info('Sending Telegram message', {
            chatId: chatId,
            textLength: text.length,
            service: 'telegram'
        });

        try {
            const response = await axios.post(url, {
                chat_id: chatId,
                text: text,
                parse_mode: 'MarkdownV2'
            });

            logger.info('Telegram message sent successfully', {
                chatId: chatId,
                messageId: response.data.result?.message_id,
                service: 'telegram'
            });

            return response.data;
        } catch (error) {
            // Graceful error handling for common Telegram API issues
            if (error.response) {
                const { status, data } = error.response;
                
                // Common Telegram errors:
                // 400 - Chat not found, invalid chat ID, or malformed MarkdownV2
                // 401 - Invalid Bot Token
                // 403 - Bot was blocked by the user
                
                if (status === 400 && data.description.includes('chat not found')) {
                    logger.error('Telegram chat not found', {
                        chatId: chatId,
                        status: status,
                        service: 'telegram'
                    });
                } else if (status === 401) {
                    logger.error('Invalid Telegram Bot Token', {
                        status: status,
                        service: 'telegram'
                    });
                } else if (status === 403) {
                    logger.error('Bot blocked by user', {
                        chatId: chatId,
                        status: status,
                        service: 'telegram'
                    });
                } else {
                    logger.error('Telegram API error', {
                        status: status,
                        description: data.description,
                        chatId: chatId,
                        service: 'telegram'
                    });
                }
                
                // Return a structured error response instead of crashing
                return { success: false, status, message: data.description };
            }

            logger.error('Telegram service error', {
                error: error.message,
                stack: error.stack,
                chatId: chatId,
                service: 'telegram'
            });
            throw error;
        }
    }

    /**
     * Escapes characters for Telegram's MarkdownV2 as required.
     * Characters that must be escaped: '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'
     * 
     * @param {string} text - The raw text to escape.
     * @returns {string} The escaped text.
     */
    escapeMarkdownV2(text) {
        // Characters that must be escaped for MarkdownV2:
        // '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'
        return text.replace(/[_\*\[\]\(\)~`>#\+\-=\|{}\.\!]/g, '\\$&');
    }
}

module.exports = new TelegramService();
