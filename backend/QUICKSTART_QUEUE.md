# Quick Start: BullMQ Queue System

Get the queue system running in 5 minutes.

## Prerequisites Check

```bash
# Check Node.js version (need 18+)
node --version

# Check if Redis is installed
redis-cli --version
```

## Step 1: Install Redis

### macOS
```bash
brew install redis
brew services start redis
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

### Windows (Docker)
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

### Verify Redis
```bash
redis-cli ping
# Should return: PONG
```

## Step 2: Install Dependencies

```bash
cd backend
npm install
```

This installs `bullmq` and `ioredis`.

## Step 3: Configure Environment

Add to `backend/.env`:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Worker Configuration
WORKER_CONCURRENCY=5
```

## Step 4: Start the Server

```bash
npm start
```

Look for these log messages:
```
[INFO] Connected to MongoDB
[INFO] BullMQ worker started { concurrency: 5, redisHost: 'localhost' }
[INFO] Event poller worker started successfully
[INFO] Server started successfully { port: 5000 }
```

## Step 5: Test the Queue

### Check Queue Stats
```bash
curl http://localhost:5000/api/queue/stats
```

Expected response:
```json
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 0,
    "completed": 0,
    "failed": 0,
    "delayed": 0,
    "total": 0
  }
}
```

### Create a Test Trigger

```bash
curl -X POST http://localhost:5000/api/triggers \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "CTEST123",
    "eventName": "test_event",
    "actionType": "webhook",
    "actionUrl": "https://webhook.site/your-unique-url"
  }'
```

### Trigger an Event (Simulated)

In a real scenario, your Soroban contract would emit an event. For testing, you can manually enqueue a job:

```javascript
// In Node.js REPL or a test script
const { enqueueAction } = require('./src/worker/queue');

const trigger = {
  _id: 'test-123',
  actionType: 'webhook',
  actionUrl: 'https://webhook.site/your-unique-url',
  contractId: 'CTEST123',
  eventName: 'test_event'
};

const payload = { message: 'Hello from EventHorizon!' };

await enqueueAction(trigger, payload);
```

### Monitor Jobs

```bash
# View completed jobs
curl http://localhost:5000/api/queue/jobs?status=completed&limit=10

# View failed jobs
curl http://localhost:5000/api/queue/jobs?status=failed&limit=10
```

## Troubleshooting

### Redis Connection Error

**Error:** `connect ECONNREFUSED 127.0.0.1:6379`

**Fix:**
```bash
# Check if Redis is running
redis-cli ping

# If not, start it
brew services start redis  # macOS
sudo systemctl start redis # Linux
docker start redis         # Docker
```

### Worker Not Starting

**Check logs:**
```bash
tail -f backend/logs/combined.log
```

**Common issues:**
- Redis not running
- Wrong Redis host/port in `.env`
- Missing dependencies (run `npm install`)

### Jobs Stuck in Waiting

**Restart the worker:**
```bash
# Stop server (Ctrl+C)
# Start again
npm start
```

## What's Next?

- Read [QUEUE_SETUP.md](QUEUE_SETUP.md) for detailed documentation
- Check [examples/queue-usage.js](examples/queue-usage.js) for code examples
- Review [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) if upgrading

## Common Commands

```bash
# Start server
npm start

# Start with auto-reload (development)
npm run dev

# Check Redis status
redis-cli ping

# View Redis keys
redis-cli keys "bull:action-queue:*"

# Clear all queue data (careful!)
redis-cli FLUSHDB

# Monitor Redis in real-time
redis-cli MONITOR
```

## Architecture Overview

```
┌─────────────┐
│   Poller    │  Detects Soroban events
└──────┬──────┘
       │ enqueueAction()
       ▼
┌─────────────┐
│    Queue    │  Redis-backed job queue
│   (Redis)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Worker    │  Processes jobs (5 concurrent)
│    Pool     │  - Discord notifications
└──────┬──────┘  - Email sending
       │         - Webhook calls
       │         - Telegram messages
       ▼
┌─────────────┐
│  External   │  Discord, Email, Webhooks, etc.
│  Services   │
└─────────────┘
```

## Key Benefits

✅ **Reliable**: Jobs survive crashes  
✅ **Scalable**: Concurrent processing  
✅ **Resilient**: Automatic retries  
✅ **Observable**: Monitor via API  
✅ **Fast**: Poller never blocked  

## Need Help?

1. Check logs: `backend/logs/combined.log`
2. Verify Redis: `redis-cli ping`
3. Test queue: `curl http://localhost:5000/api/queue/stats`
4. Review docs: [QUEUE_SETUP.md](QUEUE_SETUP.md)

Happy queueing! 🚀
