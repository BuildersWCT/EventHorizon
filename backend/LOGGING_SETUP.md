# Logging System Setup

## Installation

Install the Winston dependencies:

```bash
cd backend
npm install winston winston-daily-rotate-file
```

## What's Changed

### New Files
- `src/config/logger.js` - Winston logger configuration
- `src/middleware/logging.middleware.js` - HTTP request/response logging
- `src/config/README.md` - Logging documentation
- `logs/` directory for log files

### Updated Files
- `package.json` - Added winston dependency
- `server.js` - Replaced console.log with structured logging
- `worker/poller.js` - Added structured logging for event polling
- `controllers/trigger.controller.js` - Added request/response logging
- `services/telegram.service.js` - Improved error logging
- `.gitignore` - Added log files to ignore list

### Features
- **Multi-level logging**: error, warn, info, debug
- **JSON format**: Easy integration with ELK/Grafana
- **Daily rotation**: Automatic log file management
- **HTTP logging**: Request/response tracking
- **Structured metadata**: Rich context for debugging
- **Environment-aware**: Different log levels for dev/prod

## Usage

The logger is now available throughout the application:

```javascript
const logger = require('../config/logger');

logger.info('Operation completed', { userId: '123', duration: '50ms' });
logger.error('Operation failed', { error: err.message, stack: err.stack });
```

## Next Steps

1. Install dependencies: `npm install`
2. Start the server: `npm run dev`
3. Check logs in `backend/logs/` directory
4. Configure log aggregation tools to consume JSON logs