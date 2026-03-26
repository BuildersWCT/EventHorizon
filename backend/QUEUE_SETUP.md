# BullMQ Queue Setup

This document explains the background job processing system using BullMQ and Redis.

## Overview

The application uses BullMQ for reliable background processing of trigger actions (Discord, Email, Telegram, Webhooks). This decouples the event poller from HTTP calls, improving reliability and scalability.

## Architecture

```
Event Poller → Queue (Redis) → Worker Pool → External Services
```

1. **Poller** (`poller.js`): Detects Soroban events and enqueues actions
2. **Queue** (`queue.js`): Manages job storage and retrieval via Redis
3. **Processor** (`processor.js`): Worker pool that executes actions with retries
4. **Controller** (`queue.controller.js`): API endpoints for monitoring

## Features

- **Guaranteed Delivery**: Jobs are persisted in Redis and survive crashes
- **Automatic Retries**: Failed jobs retry with exponential backoff (3 attempts)
- **Concurrency Control**: Configurable worker pool size (default: 5)
- **Rate Limiting**: Built-in rate limiter (10 jobs/second)
- **Job Tracking**: Monitor job status via API endpoints
- **Graceful Shutdown**: Workers complete current jobs before stopping

## Prerequisites

### Install Redis

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows:**
Download from https://redis.io/download or use Docker:
```bash
docker run -d -p 6379:6379 redis:alpine
```

**Verify Redis:**
```bash
redis-cli ping
# Should return: PONG
```

## Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment variables in `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
WORKER_CONCURRENCY=5
```

3. Start the server (worker starts automatically):
```bash
npm start
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | - | Redis password (optional) |
| `WORKER_CONCURRENCY` | `5` | Number of concurrent jobs |

### Job Options

Jobs are configured with:
- **Attempts**: 3 retries on failure
- **Backoff**: Exponential (2s, 4s, 8s)
- **Retention**: Completed jobs kept 24h, failed jobs kept 7 days

## API Endpoints

### Get Queue Statistics
```http
GET /api/queue/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3,
    "delayed": 0,
    "total": 160
  }
}
```

### Get Jobs by Status
```http
GET /api/queue/jobs?status=failed&limit=50
```

Query Parameters:
- `status`: `waiting`, `active`, `completed`, `failed`, `delayed`
- `limit`: Number of jobs to return (default: 50)

### Clean Old Jobs
```http
POST /api/queue/clean
```

Removes completed jobs older than 24 hours and failed jobs older than 7 days.

### Retry Failed Job
```http
POST /api/queue/jobs/{jobId}/retry
```

## Usage Example

### Enqueue an Action

```javascript
const { enqueueAction } = require('./worker/queue');

// When an event is detected
const trigger = {
  _id: 'trigger-id',
  actionType: 'discord',
  actionUrl: 'https://discord.com/api/webhooks/...',
  contractId: 'CXXX...',
  eventName: 'transfer',
};

const eventPayload = {
  from: 'GXXX...',
  to: 'GYYY...',
  amount: '1000',
};

await enqueueAction(trigger, eventPayload);
```

### Monitor Queue

```javascript
const { getQueueStats } = require('./worker/queue');

const stats = await getQueueStats();
console.log(`Active jobs: ${stats.active}`);
console.log(`Failed jobs: ${stats.failed}`);
```

## Monitoring with Bull Board (Optional)

To add a web UI for queue monitoring:

1. Install Bull Board:
```bash
npm install @bull-board/express @bull-board/api
```

2. Add to `server.js`:
```javascript
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { actionQueue } = require('./worker/queue');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(actionQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

3. Access at: `http://localhost:5000/admin/queues`

## Troubleshooting

### Redis Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Ensure Redis is running: `redis-cli ping`

### Jobs Stuck in Waiting
**Solution**: Check worker logs. Worker may have crashed. Restart server.

### High Memory Usage
**Solution**: Reduce `WORKER_CONCURRENCY` or clean old jobs more frequently.

### Jobs Failing Repeatedly
**Solution**: Check logs for error details. Verify external service credentials (Discord webhook, SMTP, etc.).

## Production Considerations

1. **Redis Persistence**: Enable AOF or RDB snapshots
2. **Redis Cluster**: Use Redis Cluster for high availability
3. **Monitoring**: Set up alerts for failed job count
4. **Scaling**: Run multiple worker processes on different servers
5. **Security**: Use Redis password and TLS in production

## Performance Tuning

- **Increase Concurrency**: Higher `WORKER_CONCURRENCY` for more throughput
- **Adjust Rate Limits**: Modify limiter in `processor.js`
- **Job Priority**: Set `priority` when enqueuing (lower = higher priority)
- **Batch Processing**: Group similar jobs for efficiency

## Logs

Worker logs include:
- Job enqueued
- Job processing started
- Job completed/failed
- Worker errors

Example:
```
[INFO] Action enqueued { jobId: 'trigger-123-1234567890', actionType: 'discord' }
[INFO] Processing action job { jobId: 'trigger-123-1234567890', attempt: 1 }
[INFO] Job completed { jobId: 'trigger-123-1234567890' }
```
