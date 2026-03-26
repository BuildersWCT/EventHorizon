const { rpc, Transaction, xdr } = require('@stellar/stellar-sdk');
const Trigger = require('../models/trigger.model');
const logger = require('../config/logger');

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(RPC_URL);

// Try to load queue, fallback to direct execution if unavailable
let enqueueAction;
let queueAvailable = false;

try {
    const queue = require('./queue');
    enqueueAction = queue.enqueueAction;
    queueAvailable = true;
    logger.info('Queue system available - actions will be processed in background');
} catch (error) {
    logger.warn('Queue system unavailable - actions will be executed directly', {
        error: error.message,
        note: 'Install Redis to enable background job processing'
    });
    
    // Fallback: direct execution
    const axios = require('axios');
    const { sendEventNotification } = require('../services/email.service');
    const { sendDiscordNotification } = require('../services/discord.service');
    const telegramService = require('../services/telegram.service');
    
    enqueueAction = async function executeTriggerActionDirect(trigger, eventPayload) {
        const { actionType, actionUrl, contractId, eventName } = trigger;
        
        logger.info('Executing action directly (no queue)', {
            actionType,
            contractId,
            eventName,
        });
        
        switch (actionType) {
            case 'email':
                return await sendEventNotification({
                    trigger,
                    payload: eventPayload,
                });
            
            case 'discord':
                if (!actionUrl) {
                    throw new Error('Missing actionUrl for Discord trigger');
                }
                const discordPayload = {
                    embeds: [{
                        title: `Event: ${eventName}`,
                        description: `Contract: ${contractId}`,
                        fields: [{
                            name: 'Payload',
                            value: `\`\`\`json\n${JSON.stringify(eventPayload, null, 2).slice(0, 1000)}\n\`\`\``,
                        }],
                        color: 0x5865F2,
                        timestamp: new Date().toISOString(),
                    }],
                };
                return await sendDiscordNotification(actionUrl, discordPayload);
            
            case 'telegram':
                const { botToken, chatId } = trigger;
                if (!botToken || !chatId) {
                    throw new Error('Missing botToken or chatId for Telegram trigger');
                }
                const message = `🔔 *Event Triggered*\n\n` +
                    `*Event:* ${telegramService.escapeMarkdownV2(eventName)}\n` +
                    `*Contract:* \`${contractId}\`\n\n` +
                    `*Payload:*\n\`\`\`\n${JSON.stringify(eventPayload, null, 2)}\n\`\`\``;
                return await telegramService.sendTelegramMessage(botToken, chatId, message);
            
            case 'webhook':
                if (!actionUrl) {
                    throw new Error('Missing actionUrl for webhook trigger');
                }
                return await axios.post(actionUrl, {
                    contractId,
                    eventName,
                    payload: eventPayload,
                });
            
            default:
                throw new Error(`Unsupported action type: ${actionType}`);
        }
    };
}

async function pollEvents() {
    try {
        const triggers = await Trigger.find({ isActive: true });
        
        if (triggers.length === 0) {
            logger.debug('No active triggers found for polling');
            return;
        }

        logger.info('Starting event polling cycle', { 
            activeTriggers: triggers.length,
            rpcUrl: RPC_URL
        });

        for (const trigger of triggers) {
            logger.debug(`Polling for: ${trigger.eventName} on ${trigger.contractId}`);

            // Logic to poll Soroban Events
            // In a real scenario, we'd use getEvents with a startLedger
            // and filter by contractId and topics.
            // When an event is matched, enqueue the action instead of executing directly:
            // await enqueueAction(trigger, matchedEventPayload);
        }
        
        logger.info('Event polling cycle completed', { 
            processedTriggers: triggers.length 
        });
    } catch (error) {
        logger.error('Error in event poller', {
            error: error.message,
            stack: error.stack,
            rpcUrl: RPC_URL
        });
    }
}

function start() {
    const pollInterval = process.env.POLL_INTERVAL_MS || 10000;
    
    logger.info('Event poller worker starting', {
        pollInterval: pollInterval,
        rpcUrl: RPC_URL,
        queueEnabled: queueAvailable,
    });
    
    setInterval(pollEvents, pollInterval);
    
    logger.info('Event poller worker started successfully', {
        intervalMs: pollInterval,
        mode: queueAvailable ? 'background-queue' : 'direct-execution',
    });
}

module.exports = {
    start,
    enqueueAction,
};
