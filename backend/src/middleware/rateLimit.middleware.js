const rateLimit = require('express-rate-limit');

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildLimiter = ({ windowMs, max, message }) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message,
        },
        handler: (req, res, _next, options) => {
            const resetTimeMs = req.rateLimit?.resetTime
                ? req.rateLimit.resetTime.getTime() - Date.now()
                : options.windowMs;

            res.status(options.statusCode).json({
                success: false,
                message,
                retryAfterSeconds: Math.max(1, Math.ceil(resetTimeMs / 1000)),
            });
        },
    });

const globalRateLimiter = buildLimiter({
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parsePositiveInt(process.env.RATE_LIMIT_MAX, 120),
    message:
        process.env.RATE_LIMIT_MESSAGE ||
        'Too many requests from this IP. Please try again shortly.',
});

const authRateLimiter = buildLimiter({
    windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
    message:
        process.env.AUTH_RATE_LIMIT_MESSAGE ||
        'Too many authentication attempts. Please wait before trying again.',
});

module.exports = {
    globalRateLimiter,
    authRateLimiter,
};
