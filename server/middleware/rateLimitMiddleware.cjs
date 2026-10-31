/**
 * Phase 13 Enterprise Rate Limiting Middleware
 * In-memory sliding-window rate limiter with per-endpoint tiers.
 * Protects against credential stuffing, brute force, search spam, and write storms.
 */
'use strict';

const buckets = new Map(); // key -> [timestamps]

// Clean up stale buckets every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of buckets.entries()) {
        const valid = timestamps.filter(t => now - t < 120000);
        if (valid.length === 0) {
            buckets.delete(key);
        } else {
            buckets.set(key, valid);
        }
    }
}, 5 * 60 * 1000).unref();

function createRateLimiter(options = {}) {
    const windowMs = options.windowMs || 60 * 1000;
    const max = options.max || 30;
    const message = options.message || 'Too many requests. Please try again shortly.';
    const keyPrefix = options.keyPrefix || 'rl';

    return function rateLimiter(req, res, next) {
        // Safe bypass for load testing when explicitly permitted
        if (process.env.DISABLE_RATE_LIMIT === 'true' || req.headers['x-bypass-rate-limit'] === process.env.INTERNAL_API_SECRET) {
            return next();
        }

        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        const userKey = req.user ? req.user.id : ip;
        const bucketKey = `${keyPrefix}:${userKey}`;

        const now = Date.now();
        const timestamps = buckets.get(bucketKey) || [];
        const windowStart = now - windowMs;

        // Filter timestamps within current window
        const activeTimestamps = timestamps.filter(t => t > windowStart);

        if (activeTimestamps.length >= max) {
            const oldest = activeTimestamps[0];
            const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
            res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
            res.setHeader('X-RateLimit-Limit', String(max));
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', String(Math.ceil((oldest + windowMs) / 1000)));
            return res.status(429).json({
                error: message,
                retryAfter: Math.max(1, retryAfterSec)
            });
        }

        activeTimestamps.push(now);
        buckets.set(bucketKey, activeTimestamps);

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(max - activeTimestamps.length));

        next();
    };
}

// Configured Rate Limiters by Endpoint Category
const authLoginLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'login',
    message: 'Too many login attempts. Please wait a minute before trying again.'
});

const authSignupLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    keyPrefix: 'signup',
    message: 'Too many account registrations from this IP. Please wait before creating more.'
});

const searchLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: 'search',
    message: 'Search query rate limit exceeded. Please slow down.'
});

const communityWriteLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: 'comm_write',
    message: 'Interaction rate limit reached. Please wait a few seconds before posting again.'
});

const chatMessageLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: 'chat_msg',
    message: 'You are sending messages too quickly. Please slow down.'
});

const callRequestLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'call_req',
    message: 'Too many call attempts. Please wait a minute before requesting another call.'
});

module.exports = {
    createRateLimiter,
    authLoginLimiter,
    authSignupLimiter,
    searchLimiter,
    communityWriteLimiter,
    chatMessageLimiter,
    callRequestLimiter
};

