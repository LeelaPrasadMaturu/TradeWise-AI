const ms = require('ms');

// Simple in-memory sliding window rate limiter.
// For production, consider Redis-based limiter for multi-instance deployments.

function createRateLimiter(options) {
  const {
    window = '1m',           // time window, e.g., '1m', '10m'
    max = 60,                // max requests per window
    keyGenerator,            // optional custom key (defaults to IP)
    skip = () => false       // optional skip function
  } = options || {};

  const windowMs = typeof window === 'string' ? ms(window) : window;
  const hits = new Map(); // key -> array of timestamps (ms)

  return function rateLimit(req, res, next) {
    if (skip(req)) return next();

    const key = (keyGenerator && keyGenerator(req)) || req.ip;
    const now = Date.now();
    const cutoff = now - windowMs;

    let timestamps = hits.get(key);
    if (!timestamps) {
      timestamps = [];
      hits.set(key, timestamps);
    }

    // Drop old timestamps
    while (timestamps.length && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= max) {
      const retryAfterSec = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests, please try again later.'
      });
    }

    timestamps.push(now);
    next();
  };
}

module.exports = {
  createRateLimiter
};


