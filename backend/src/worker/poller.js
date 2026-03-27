const { rpc, Transaction, xdr } = require('@stellar/stellar-sdk');
const Trigger = require('../models/trigger.model');
const axios = require('axios');

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(RPC_URL);

// Prevent requesting too many ledgers at once and angering the RPC node
const MAX_LEDGERS_PER_POLL = parseInt(process.env.MAX_LEDGERS_PER_POLL || '10000', 10);

async function pollEvents() {
    try {
        const triggers = await Trigger.find({ isActive: true });
        if (triggers.length === 0) return;

        // 1. Get the current network tip to cap our sliding window
        let latestLedgerSequence = 0;
        try {
            const latest = await server.getLatestLedger();
            latestLedgerSequence = latest.sequence;
        } catch (e) {
            console.error('⚠️ Failed to get latest ledger from RPC:', e.message);
            return;
        }

        for (const trigger of triggers) {
            console.log(`🔍 Polling for: ${trigger.eventName} on ${trigger.contractId}`);
            
            try {
                // Determine our ledger bounds for this trigger
                let startLedger = trigger.lastPolledLedger;
                if (!startLedger || startLedger === 0) {
                    // Start close to the current network tip if it's brand new
                    startLedger = Math.max(1, latestLedgerSequence - 100);
                } else {
                    // If we've already polled up to or past the network tip, skip
                    if (startLedger >= latestLedgerSequence) continue;
                    // Usually we want to start from the *next* ledger
                    startLedger += 1;
                }

                // Apply max window size
                const endLedger = Math.min(startLedger + MAX_LEDGERS_PER_POLL, latestLedgerSequence);

                // Convert event name to XDR format for topic filtering
                // Note: Soroban getEvents expects topics in XDR base64
                const eventTopicXdr = xdr.ScVal.scvSymbol(trigger.eventName).toXDR("base64");

                let cursor = undefined;
                let foundEvents = 0;

                // 2. Fetch events with pagination support
                while (true) {
                    const response = await server.getEvents({
                        startLedger,
                        filters: [
                            {
                                type: "contract",
                                contractIds: [trigger.contractId],
                                topics: [ [eventTopicXdr] ]
                            }
                        ],
                        pagination: { limit: 100, cursor }
                    });

                    // Parse the events
                    if (response && response.events && response.events.length > 0) {
                        for (const event of response.events) {
                            // Ensure the event falls within our intended window
                            if (event.ledger <= endLedger) {
                                foundEvents++;
                                // NOTE: Here we would typically dispatch to Webhook/Discord/etc.
                                // e.g. await axios.post(trigger.actionUrl, { eventData: event.value })
                            }
                        }

                        // Determine if there are more pages
                        const lastEvent = response.events[response.events.length - 1];
                        if (response.events.length >= 100 && lastEvent && lastEvent.id) {
                            cursor = lastEvent.id;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }

                    // Optional short sleep between pages to avoid immediately tripping rate limits
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                // 3. Update trigger state
                trigger.lastPolledLedger = endLedger;
                await trigger.save();

                if (foundEvents > 0) {
                    console.log(`✅ Collected ${foundEvents} events for trigger ${trigger._id}`);
                }

            } catch (triggerError) {
                console.error(`❌ Error processing trigger ${trigger._id}:`, triggerError.message);
                // On failure, we skip updating lastPolledLedger so it will retry on the next interval
            }
        }
    } catch (error) {
        console.error('❌ Error in poller loop:', error);
    }
}

function start() {
    const intervalMs = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10);
    setInterval(pollEvents, intervalMs);
    console.log(`🤖 Event poller worker started (interval: ${intervalMs}ms)`);
}

module.exports = { start };
