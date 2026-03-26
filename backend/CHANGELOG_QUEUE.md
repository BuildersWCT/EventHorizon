# Changelog: BullMQ Queue Integration

## Summary

Integrated BullMQ with Redis for reliable background processing of trigger actions (Discord, Email, Telegram, Webhooks). This decouples the event poller from HTTP calls, improving reliability, scalability, and observability.

## Changes

### New Files

1. **`src/worker/processor.js`**
   - BullMQ worker implementation
   - Executes actions with retry logic
   - Handles Discord, Email, Telegram, and Webhook actions
   - Configurable concurrency (default: 5 workers)
   - Built-in rate limiting (10 jobs/second)

2. **`src/worker/queue.js`**
   - Queue management and job creation
   - Redis connection configuration
   - Job enqueuing with retry policies
   - Queue statistics and monitoring
   - Automatic job cleanup

3. **`src/controllers/queue.controller.js`**
   - API endpoints for queue monitoring
   - Get queue statistics
   - List jobs by status
   - Retry failed jobs
   - Clean old jobs

4. **`src/routes/queue.routes.js`**
   - Express routes for queue API
   - `/api/queue/stats` - Queue statistics
   - `/api/queue/jobs` - List jobs
   - `/api/queue/clean` - Clean old jobs
   - `/api/queue/jobs/:jobId/retry` - Retry job

5. **`QUEUE_SETUP.md`**
   - Comprehensive setup guide
   - Redis installation instructions
   - Configuration reference
   - API documentation
   - Troubleshooting guide
   - Production considerations

6. **`MIGRATION_GUIDE.md`**
   - Step-by-step migration instructions
   - Before/after code comparison
   - Rollback plan
   - Performance impact analysis
   - Production checklist

7. **`examples/queue-usage.js`**
   - Practical usage examples
   - Enqueue different action types
   - Monitor queue statistics
   - Job management examples
   - Event listener setup

8. **`__tests__/queue.test.js`**
   - Basic queue integration tests
   - Job enqueuing test
   - Statistics retrieval test

### Modified Files

1. **`package.json`**
   - Added `bullmq@^5.0.0`
   - Added `ioredis@^5.3.0`

2. **`src/worker/poller.js`**
   - Replaced direct `executeTriggerAction()` calls
   - Now uses `enqueueAction()` from queue
   - Removed axios and email service imports
   - Added logger import
   - Updated comments to reflect queue usage

3. **`src/server.js`**
   - Initialize BullMQ worker on startup
   - Added queue routes (`/api/queue`)
   - Graceful shutdown handling for worker
   - Worker starts after MongoDB connection

4. **`.env.example`**
   - Added Redis configuration:
     - `REDIS_HOST`
     - `REDIS_PORT`
     - `REDIS_PASSWORD`
   - Added worker configuration:
     - `WORKER_CONCURRENCY`

5. **`README.md`**
   - Added Redis to prerequisites
   - Added background job processing section
   - Link to QUEUE_SETUP.md

### Removed Code

- `executeTriggerAction()` function from `poller.js` (moved to processor.js)
- Direct action execution in poller loop

## Features

### Guaranteed Delivery
- Jobs persisted in Redis
- Survive application crashes
- Automatic retries on failure (3 attempts)
- Exponential backoff (2s, 4s, 8s)

### Concurrency Control
- Configurable worker pool size
- Rate limiting (10 jobs/second)
- Prevents overwhelming external APIs

### Job Tracking
- Monitor job status via API
- View waiting, active, completed, failed jobs
- Retry failed jobs manually
- Automatic cleanup of old jobs

### Improved Reliability
- Poller no longer blocked by slow HTTP calls
- Failed actions don't crash poller
- Better error handling and logging

### Scalability
- Horizontal scaling (multiple worker processes)
- Queue-based architecture
- Independent scaling of poller and workers

## API Endpoints

### GET /api/queue/stats
Get queue statistics (waiting, active, completed, failed, delayed counts).

### GET /api/queue/jobs?status={status}&limit={limit}
List jobs by status (waiting, active, completed, failed, delayed).

### POST /api/queue/clean
Clean old completed (24h+) and failed (7d+) jobs.

### POST /api/queue/jobs/:jobId/retry
Retry a specific failed job.

## Configuration

### Environment Variables

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Worker
WORKER_CONCURRENCY=5
```

### Job Options

- **Attempts**: 3 retries
- **Backoff**: Exponential (2s base)
- **Retention**: 
  - Completed: 24 hours
  - Failed: 7 days

## Migration Path

1. Install Redis
2. Run `npm install` (installs bullmq, ioredis)
3. Update `.env` with Redis config
4. Restart server (worker auto-starts)
5. Monitor via `/api/queue/stats`

## Breaking Changes

None. All existing API endpoints remain unchanged. Queue system is internal.

## Performance Impact

### Improvements
- ✅ Poller no longer blocked by HTTP calls
- ✅ Concurrent action execution (5 workers)
- ✅ Automatic retries on failure
- ✅ Better observability

### Resource Usage
- +50-100MB memory (Redis)
- Minimal CPU increase
- Same network usage

## Testing

Run queue tests:
```bash
npm test -- queue.test.js
```

## Rollback

If needed, revert these commits and:
1. Stop server
2. Restore old `poller.js` from git
3. Remove worker initialization from `server.js`
4. Restart server

## Future Enhancements

- [ ] Bull Board UI for visual monitoring
- [ ] Prometheus metrics export
- [ ] Job priority queues
- [ ] Scheduled/delayed jobs
- [ ] Dead letter queue
- [ ] Job result webhooks

## Credits

- **BullMQ**: https://docs.bullmq.io/
- **ioredis**: https://github.com/redis/ioredis
- **Redis**: https://redis.io/

## Commit Message

```
perf: integrate bullmq for background action processing

- Add BullMQ worker for reliable action execution
- Decouple poller from HTTP calls for better reliability
- Add queue monitoring API endpoints
- Implement automatic retries with exponential backoff
- Add concurrency control and rate limiting
- Include comprehensive setup and migration guides

BREAKING CHANGE: Requires Redis installation
```
