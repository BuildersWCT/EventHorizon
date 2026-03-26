const logger = require('../config/logger');

/**
 * HTTP request logging middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log incoming request
    logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args) {
        const duration = Date.now() - start;
        
        logger.info('HTTP Response', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip
        });
        
        originalEnd.apply(this, args);
    };

    next();
};

/**
 * Error logging middleware
 */
const errorLogger = (err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    next(err);
};

module.exports = {
    requestLogger,
    errorLogger
};