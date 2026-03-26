/**
 * Example: Using the BullMQ Queue System
 * 
 * This file demonstrates how to enqueue actions and monitor the queue.
 */

const { enqueueAction, getQueueStats, actionQueue } = require('../src/worker/queue');

// Example 1: Enqueue a Discord notification
async function exampleDiscordNotification() {
    const trigger = {
        _id: 'trigger-discord-001',
        actionType: 'discord',
        actionUrl: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
        contractId: 'CXXX...XXX',
        eventName: 'SwapExecuted',
    };

    const eventPayload = {
        tokenIn: 'USDC',
        tokenOut: 'XLM',
        amountIn: '1000',
        amountOut: '5000',
        trader: 'GXXX...XXX',
    };

    try {
        const job = await enqueueAction(trigger, eventPayload);
        console.log(`✅ Discord notification enqueued: ${job.id}`);
        return job;
    } catch (error) {
        console.error('❌ Failed to enqueue:', error.message);
    }
}

// Example 2: Enqueue an email notification
async function exampleEmailNotification() {
    const trigger = {
        _id: 'trigger-email-001',
        actionType: 'email',
        actionUrl: 'user@example.com',
        contractId: 'CYYY...YYY',
        eventName: 'TokensVested',
    };

    const eventPayload = {
        beneficiary: 'GZZZ...ZZZ',
        amount: '50000',
        timestamp: Date.now(),
    };

    try {
        const job = await enqueueAction(trigger, eventPayload);
        console.log(`✅ Email notification enqueued: ${job.id}`);
        return job;
    } catch (error) {
        console.error('❌ Failed to enqueue:', error.message);
    }
}

// Example 3: Enqueue a webhook call
async function exampleWebhook() {
    const trigger = {
        _id: 'trigger-webhook-001',
        actionType: 'webhook',
        actionUrl: 'https://api.example.com/webhooks/soroban-events',
        contractId: 'CAAA...AAA',
        eventName: 'StakeCreated',
        priority: 1, // Higher priority (lower number = higher priority)
    };

    const eventPayload = {
        staker: 'GBBB...BBB',
        amount: '10000',
        duration: 30,
    };

    try {
        const job = await enqueueAction(trigger, eventPayload);
        console.log(`✅ Webhook enqueued: ${job.id}`);
        return job;
    } catch (error) {
        console.error('❌ Failed to enqueue:', error.message);
    }
}

// Example 4: Monitor queue statistics
async function monitorQueue() {
    try {
        const stats = await getQueueStats();
        console.log('\n📊 Queue Statistics:');
        console.log(`   Waiting: ${stats.waiting}`);
        console.log(`   Active: ${stats.active}`);
        console.log(`   Completed: ${stats.completed}`);
        console.log(`   Failed: ${stats.failed}`);
        console.log(`   Delayed: ${stats.delayed}`);
        console.log(`   Total: ${stats.total}\n`);
        return stats;
    } catch (error) {
        console.error('❌ Failed to get stats:', error.message);
    }
}

// Example 5: Get job details
async function getJobDetails(jobId) {
    try {
        const job = await actionQueue.getJob(jobId);
        
        if (!job) {
            console.log(`❌ Job ${jobId} not found`);
            return null;
        }

        console.log('\n📋 Job Details:');
        console.log(`   ID: ${job.id}`);
        console.log(`   Name: ${job.name}`);
        console.log(`   Action Type: ${job.data.trigger.actionType}`);
        console.log(`   Contract: ${job.data.trigger.contractId}`);
        console.log(`   Event: ${job.data.trigger.eventName}`);
        console.log(`   Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
        console.log(`   State: ${await job.getState()}`);
        
        if (job.processedOn) {
            console.log(`   Processed: ${new Date(job.processedOn).toISOString()}`);
        }
        
        if (job.finishedOn) {
            console.log(`   Finished: ${new Date(job.finishedOn).toISOString()}`);
        }
        
        if (job.failedReason) {
            console.log(`   Failed Reason: ${job.failedReason}`);
        }
        
        console.log('');
        return job;
    } catch (error) {
        console.error('❌ Failed to get job:', error.message);
    }
}

// Example 6: Retry a failed job
async function retryFailedJob(jobId) {
    try {
        const job = await actionQueue.getJob(jobId);
        
        if (!job) {
            console.log(`❌ Job ${jobId} not found`);
            return;
        }

        const state = await job.getState();
        if (state !== 'failed') {
            console.log(`⚠️  Job ${jobId} is not in failed state (current: ${state})`);
            return;
        }

        await job.retry();
        console.log(`✅ Job ${jobId} retry initiated`);
    } catch (error) {
        console.error('❌ Failed to retry job:', error.message);
    }
}

// Example 7: Listen to job events
function setupJobListeners() {
    actionQueue.on('completed', (job) => {
        console.log(`✅ Job ${job.id} completed successfully`);
    });

    actionQueue.on('failed', (job, err) => {
        console.log(`❌ Job ${job.id} failed: ${err.message}`);
    });

    actionQueue.on('progress', (job, progress) => {
        console.log(`⏳ Job ${job.id} progress: ${progress}%`);
    });

    console.log('👂 Listening to queue events...');
}

// Run examples
async function runExamples() {
    console.log('🚀 BullMQ Queue Usage Examples\n');

    // Monitor initial state
    await monitorQueue();

    // Enqueue some jobs
    const job1 = await exampleDiscordNotification();
    const job2 = await exampleEmailNotification();
    const job3 = await exampleWebhook();

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check stats again
    await monitorQueue();

    // Get details of first job
    if (job1) {
        await getJobDetails(job1.id);
    }

    // Setup listeners (optional)
    // setupJobListeners();

    console.log('✨ Examples completed!\n');
}

// Uncomment to run examples
// runExamples().catch(console.error);

module.exports = {
    exampleDiscordNotification,
    exampleEmailNotification,
    exampleWebhook,
    monitorQueue,
    getJobDetails,
    retryFailedJob,
    setupJobListeners,
};
