# Logging Configuration

This project uses Winston for structured logging with multiple levels and transports.

## Log Levels

- `error`: Error conditions that need immediate attention
- `warn`: Warning conditions that should be noted
- `info`: General information about application flow
- `debug`: Detailed information for debugging (only in development)

## Log Outputs

### Console
- Development: Shows all levels with colors
- Production: Shows info and above

### Files
- `backend/logs/app.log`: All application logs (info and above)
- `backend/logs/error.log`: Error logs only
- Daily rotation with 30-day retention
- Maximum 10MB per file

## Log Format

All logs are structured in JSON format for easy parsing:

```json
{
  "timestamp": "2024-03-24 10:30:45",
  "level": "info",
  "message": "Server started successfully",
  "port": 5000,
  "environment": "development",
  "pid": 12345
}
```

## Usage Examples

```javascript
const logger = require('../config/logger');

// Basic logging
logger.info('User logged in');
logger.error('Database connection failed');

// Structured logging with metadata
logger.info('API request processed', {
  method: 'POST',
  endpoint: '/api/triggers',
  userId: '12345',
  duration: '150ms'
});

logger.error('Payment processing failed', {
  error: error.message,
  stack: error.stack,
  userId: '12345',
  amount: 100.00
});
```

## Environment Variables

- `NODE_ENV`: Controls log level (production = info+, development = debug+)

## Integration with ELK/Grafana

The JSON format makes it easy to ingest logs into:
- Elasticsearch for searching and analysis
- Grafana for visualization and alerting
- Other log aggregation systems