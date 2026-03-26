# Migration Guide: Adding BullMQ Queue System

This guide helps you migrate from direct action execution to the BullMQ-based queue system.

## What Changed

### Before (Direct Execution)
```javascript
// poller.js - Old approach
await executeTriggerAction(trigger, eventPayload);
// Blocks until HTTP call completes
// No retry on failure
// Crashes affect polling
```

### After (Queue-Based)
```javascript
// poller.js - New approach
await enqueueAction(trigger, eventPayload);
// Returns immediately
// Worker handles execution with retries
// Polling continues even if actions fail
```

## Migration Steps

### 1. Install Redis

Choose your platform:

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

Verify:
```bash
redis-cli ping
# Should return: PONG
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

This installs:
- `bullmq@^5.0.0` - Job queue library
- `ioredis@^5.3.0` - Redis client

### 3. Update Environment Variables

Add to your `.env` file:

```env
# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Worker configuration
WORKER_CONCURRENCY=5
```

### 4. Update Code (Already Done)

The following files have been updated:
- ✅ `src/worker/processor.js` - New worker implementation
- ✅ `src/worker/queue.js` - Queue management
- ✅ `src/worker/poller.js` - Now uses `enqueueAction()`
- ✅ `src/server.js` - Initializes worker on startup
- ✅ `src/controllers/queue.controller.js` - Queue monitoring API
- ✅ `src/routes/queue.routes.js` - Queue endpoints

### 5. Test the Migration

Start the server:
```bash
npm start
```

Check logs for:
```
[INFO] BullMQ worker started { concurrency: 5, redisHost: 'localhost' }
[INFO] Event poller worker started successfully
```

### 6. Verify Queue is Working

Create a test trigger and check queue stats:
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

### 7. Monitor Jobs

View recent jobs:
```bash
# Completed jobs
curl http://localhost:5000/api/queue/jobs?status=completed&limit=10

# Failed jobs
curl http://localhost:5000/api/queue/jobs?status=failed&limit=10
```

## Rollback Plan

If you need to rollback:

1. Stop the server
2. Revert `src/worker/poller.js` to use `executeTriggerAction()` directly
3. Remove worker initialization from `src/server.js`
4. Restart server

The old code is preserved in git history.

## Breaking Changes

### None for API Users
All existing API endpoints remain unchanged. The queue system is internal.

### For Developers

If you have custom code that calls `executeTriggerAction()`:

**Old:**
```javascript
const { executeTriggerAction } = require('./worker/poller');
await executeTriggerAction(trigger, payload);
```

**New:**
```javascript
const { enqueueAction } = require('./worker/queue');
await enqueueAction(trigger, payload);
```

## Performance Impact

### Expected Improvements
- **Poller Reliability**: No longer blocked by slow HTTP calls
- **Throughput**: Concurrent action execution (5 workers by default)
- **Resilience**: Failed actions retry automatically
- **Observability**: Job tracking and monitoring

### Resource Usage
- **Memory**: +50-100MB for Redis
- **CPU**: Minimal increase (worker pool)
- **Network**: Same (actions still make HTTP calls)

## Troubleshooting

### Server Won't Start

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:** Redis is not running. Start it:
```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker start redis
```

### Jobs Not Processing

**Check worker logs:**
```bash
# Look for worker errors in logs
tail -f backend/logs/combined.log
```

**Check Redis connection:**
```bash
redis-cli ping
```

**Restart worker:**
```bash
# Stop server
# Start server (worker auto-starts)
npm start
```

### High Failed Job Count

**View failed jobs:**
```bash
curl http://localhost:5000/api/queue/jobs?status=failed
```

**Common causes:**
- Invalid Discord webhook URL
- SMTP credentials incorrect
- External service down

**Retry failed jobs:**
```bash
curl -X POST http://localhost:5000/api/queue/jobs/{jobId}/retry
```

## Production Checklist

Before deploying to production:

- [ ] Redis is running and accessible
- [ ] Redis persistence enabled (AOF or RDB)
- [ ] Environment variables configured
- [ ] Worker concurrency tuned for your load
- [ ] Monitoring/alerts set up for failed jobs
- [ ] Redis password set (if exposed to network)
- [ ] Backup strategy for Redis data
- [ ] Load testing completed

## Support

For issues or questions:
1. Check logs in `backend/logs/`
2. Review [QUEUE_SETUP.md](QUEUE_SETUP.md)
3. Check Redis status: `redis-cli ping`
4. Verify environment variables in `.env`

## Next Steps

Consider adding:
- **Bull Board**: Web UI for queue monitoring
- **Metrics**: Prometheus/Grafana integration
- **Alerts**: Notify on high failure rate
- **Scaling**: Multiple worker processes
