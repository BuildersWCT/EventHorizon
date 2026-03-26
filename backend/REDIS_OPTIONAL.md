# Redis is Optional (Graceful Fallback)

The BullMQ queue system is **optional**. The application will work with or without Redis.

## How It Works

### With Redis (Recommended)
- ✅ Background job processing
- ✅ Automatic retries on failure
- ✅ Concurrent action execution
- ✅ Job monitoring and tracking
- ✅ Better reliability and scalability

### Without Redis (Fallback Mode)
- ⚠️ Direct action execution (blocking)
- ⚠️ No automatic retries
- ⚠️ Sequential processing
- ⚠️ No job tracking
- ⚠️ Poller can be blocked by slow HTTP calls

## Behavior

### Server Startup

**With Redis:**
```
[INFO] Connected to MongoDB
[INFO] BullMQ queue system enabled
[INFO] BullMQ worker started { concurrency: 5 }
[INFO] Event poller worker starting { queueEnabled: true }
[INFO] Server started successfully { queueEnabled: true }
```

**Without Redis:**
```
[INFO] Connected to MongoDB
[WARN] BullMQ worker initialization failed - queue system disabled
[WARN] Queue system unavailable - actions will be executed directly
[INFO] Event poller worker starting { queueEnabled: false }
[INFO] Server started successfully { queueEnabled: false }
```

### Action Execution

**With Redis:**
```javascript
// Action is enqueued and processed by worker
await enqueueAction(trigger, eventPayload);
// Returns immediately, worker processes in background
```

**Without Redis:**
```javascript
// Action is executed directly (blocking)
await executeTriggerActionDirect(trigger, eventPayload);
// Waits for HTTP call to complete
```

### API Endpoints

**With Redis:**
- `GET /api/queue/stats` - Returns queue statistics
- `GET /api/queue/jobs` - Returns job list
- `POST /api/queue/clean` - Cleans old jobs
- `POST /api/queue/jobs/:id/retry` - Retries failed job

**Without Redis:**
- All `/api/queue/*` endpoints return `503 Service Unavailable`
- Response includes helpful message about Redis requirement

## Pushing Code Without Redis

Yes, you can safely push this code without installing Redis:

1. ✅ Code compiles and runs
2. ✅ Server starts successfully
3. ✅ Poller works (direct execution mode)
4. ✅ All existing features work
5. ✅ No breaking changes

## When to Install Redis

Install Redis when you need:
- High reliability (automatic retries)
- Better performance (concurrent processing)
- Scalability (handle more triggers)
- Observability (job monitoring)
- Production deployment

## Installation (When Ready)

### Development
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows (Docker)
docker run -d -p 6379:6379 redis:alpine
```

### Production
Use a managed Redis service:
- **AWS**: ElastiCache for Redis
- **Azure**: Azure Cache for Redis
- **GCP**: Memorystore for Redis
- **Heroku**: Heroku Redis
- **Railway**: Railway Redis
- **Render**: Render Redis

## Configuration

Add to `.env` when Redis is available:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
WORKER_CONCURRENCY=5
```

If these variables are missing, the app uses fallback mode.

## Testing Without Redis

```bash
# Start server (no Redis needed)
npm start

# Create a trigger
curl -X POST http://localhost:5000/api/triggers \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "CTEST",
    "eventName": "test",
    "actionType": "webhook",
    "actionUrl": "https://webhook.site/your-url"
  }'

# Trigger will execute directly when event is detected
```

## Upgrading to Redis Later

1. Install Redis
2. Add Redis config to `.env`
3. Restart server
4. Queue system automatically activates

No code changes needed!

## Deployment Strategies

### Option 1: Deploy Without Redis First
```bash
# Deploy code
git push origin main

# Test basic functionality
# Add Redis later when needed
```

### Option 2: Deploy With Redis
```bash
# Provision Redis instance
# Configure environment variables
# Deploy code
git push origin main
```

### Option 3: Gradual Rollout
```bash
# Deploy to staging without Redis
# Test functionality
# Add Redis to staging
# Verify queue system works
# Deploy to production with Redis
```

## Monitoring

Check if queue is enabled:

```bash
curl http://localhost:5000/api/health
```

Look for `queueEnabled` in server logs.

## Summary

- ✅ **Safe to push** without Redis
- ✅ **No breaking changes** - app works in both modes
- ✅ **Graceful degradation** - falls back to direct execution
- ✅ **Easy upgrade** - just add Redis and restart
- ⚠️ **Production recommendation** - use Redis for reliability

The queue system is a **performance enhancement**, not a requirement.
