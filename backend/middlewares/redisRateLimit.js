/**
 * Redis-based Distributed Rate Limiting
 * 
 * Features:
 * - Token bucket algorithm for burst handling
 * - Sliding window log for precise limiting
 * - Per-user AND per-IP limiting
 * - Graceful degradation when Redis unavailable
 * - Circuit breaker integration
 */

const redisService = require('../services/redisService');

/**
 * Token Bucket Rate Limiter
 * Allows bursts up to bucket capacity, refills at a steady rate
 */
function createTokenBucketLimiter(options = {}) {
  const {
    capacity = 60,           // Maximum tokens (burst capacity)
    refillRate = 1,          // Tokens added per second
    keyPrefix = 'ratelimit:tb',
    keyGenerator = (req) => req.ip,
    skip = () => false,
    onRateLimited = null,
  } = options;

  return async function tokenBucketRateLimit(req, res, next) {
    if (skip(req)) return next();

    const key = `${keyPrefix}:${keyGenerator(req)}`;

    try {
      const now = Date.now();
      const result = await executeTokenBucket(key, capacity, refillRate, now);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(capacity));
      res.set('X-RateLimit-Remaining', String(Math.max(0, Math.floor(result.tokens))));
      res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

      if (!result.allowed) {
        const retryAfter = Math.ceil((capacity - result.tokens) / refillRate);
        res.set('Retry-After', String(retryAfter));

        if (onRateLimited) {
          onRateLimited(req, res);
        }

        return res.status(429).json({
          status: 'error',
          message: 'Too many requests. Please slow down.',
          retryAfter,
        });
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Token bucket error:', error.message);
      // Fail open - allow request on error
      next();
    }
  };
}

/**
 * Execute token bucket algorithm using Redis
 */
async function executeTokenBucket(key, capacity, refillRate, now) {
  if (!redisService.isConnected) {
    // Fallback: allow all requests when Redis unavailable
    return { allowed: true, tokens: capacity, resetAt: now + 1000 };
  }

  // Lua script for atomic token bucket operation
  const script = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])
    
    local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
    local tokens = tonumber(bucket[1])
    local last_update = tonumber(bucket[2])
    
    if tokens == nil then
      tokens = capacity
      last_update = now
    else
      -- Calculate tokens to add based on time elapsed
      local elapsed = (now - last_update) / 1000
      local tokens_to_add = elapsed * refill_rate
      tokens = math.min(capacity, tokens + tokens_to_add)
    end
    
    local allowed = 0
    if tokens >= requested then
      tokens = tokens - requested
      allowed = 1
    end
    
    redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 60)
    
    return {allowed, tokens, now + math.ceil((capacity - tokens) / refill_rate * 1000)}
  `;

  try {
    const result = await redisService.client.eval(script, 1, key, capacity, refillRate, now, 1);
    return {
      allowed: result[0] === 1,
      tokens: result[1],
      resetAt: result[2],
    };
  } catch (error) {
    console.error('[RateLimit] Lua script error:', error.message);
    return { allowed: true, tokens: capacity, resetAt: now + 1000 };
  }
}

/**
 * Sliding Window Log Rate Limiter
 * More accurate than fixed windows, prevents boundary attacks
 */
function createSlidingWindowLimiter(options = {}) {
  const {
    window = 60000,          // Window size in ms (default 1 minute)
    max = 60,                // Max requests per window
    keyPrefix = 'ratelimit:sw',
    keyGenerator = (req) => req.ip,
    skip = () => false,
    onRateLimited = null,
  } = options;

  // In-memory fallback for when Redis is unavailable
  const localWindows = new Map();

  return async function slidingWindowRateLimit(req, res, next) {
    if (skip(req)) return next();

    const identifier = keyGenerator(req);
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - window;

    try {
      let count;
      let remaining;

      if (redisService.isConnected) {
        // Redis-based sliding window
        count = await executeSlidingWindow(key, now, windowStart, window);
      } else {
        // Local fallback
        count = executeLocalSlidingWindow(localWindows, identifier, now, windowStart, window);
      }

      remaining = Math.max(0, max - count);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + window) / 1000)));

      if (count > max) {
        const retryAfter = Math.ceil(window / 1000);
        res.set('Retry-After', String(retryAfter));

        if (onRateLimited) {
          onRateLimited(req, res);
        }

        return res.status(429).json({
          status: 'error',
          message: 'Too many requests, please try again later.',
          retryAfter,
        });
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Sliding window error:', error.message);
      next(); // Fail open
    }
  };
}

/**
 * Execute sliding window using Redis sorted set
 */
async function executeSlidingWindow(key, now, windowStart, windowMs) {
  const multi = redisService.client.multi();
  
  // Remove old entries
  multi.zremrangebyscore(key, '-inf', windowStart);
  
  // Add current request
  multi.zadd(key, now, `${now}:${Math.random()}`);
  
  // Count requests in window
  multi.zcard(key);
  
  // Set expiry
  multi.expire(key, Math.ceil(windowMs / 1000) + 1);

  const results = await multi.exec();
  return results[2][1]; // zcard result
}

/**
 * Local fallback for sliding window
 */
function executeLocalSlidingWindow(windows, identifier, now, windowStart, windowMs) {
  let timestamps = windows.get(identifier);
  
  if (!timestamps) {
    timestamps = [];
    windows.set(identifier, timestamps);
  }

  // Remove old entries
  while (timestamps.length > 0 && timestamps[0] <= windowStart) {
    timestamps.shift();
  }

  // Add current timestamp
  timestamps.push(now);

  // Cleanup old identifiers periodically
  if (Math.random() < 0.01) {
    cleanupLocalWindows(windows, windowMs);
  }

  return timestamps.length;
}

/**
 * Cleanup stale entries from local windows
 */
function cleanupLocalWindows(windows, windowMs) {
  const cutoff = Date.now() - windowMs;
  for (const [key, timestamps] of windows.entries()) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
      windows.delete(key);
    }
  }
}

/**
 * Combined Rate Limiter with multiple strategies
 * Applies both per-IP and per-user limits
 */
function createCombinedLimiter(options = {}) {
  const {
    // IP-based limits (stricter)
    ipLimit = 300,
    ipWindow = 60000,
    
    // User-based limits (more lenient for authenticated users)
    userLimit = 600,
    userWindow = 60000,
    
    // Endpoint-specific overrides
    endpoints = {},
    
    skip = () => false,
  } = options;

  // In-memory stores for fallback
  const ipStore = new Map();
  const userStore = new Map();

  return async function combinedRateLimit(req, res, next) {
    if (skip(req)) return next();

    const now = Date.now();
    const ip = req.ip;
    const userId = req.user?._id?.toString();

    // Check for endpoint-specific limits
    const path = req.path;
    const endpointConfig = endpoints[path] || {};
    const effectiveIpLimit = endpointConfig.ipLimit || ipLimit;
    const effectiveUserLimit = endpointConfig.userLimit || userLimit;

    try {
      // Check IP limit
      const ipKey = `ratelimit:ip:${ip}`;
      const ipWindowStart = now - ipWindow;
      
      let ipCount;
      if (redisService.isConnected) {
        ipCount = await executeSlidingWindow(ipKey, now, ipWindowStart, ipWindow);
      } else {
        ipCount = executeLocalSlidingWindow(ipStore, ip, now, ipWindowStart, ipWindow);
      }

      if (ipCount > effectiveIpLimit) {
        return sendRateLimitResponse(res, effectiveIpLimit, 0, ipWindow, 'IP rate limit exceeded');
      }

      // Check user limit if authenticated
      if (userId) {
        const userKey = `ratelimit:user:${userId}`;
        const userWindowStart = now - userWindow;
        
        let userCount;
        if (redisService.isConnected) {
          userCount = await executeSlidingWindow(userKey, now, userWindowStart, userWindow);
        } else {
          userCount = executeLocalSlidingWindow(userStore, userId, now, userWindowStart, userWindow);
        }

        if (userCount > effectiveUserLimit) {
          return sendRateLimitResponse(res, effectiveUserLimit, 0, userWindow, 'User rate limit exceeded');
        }

        res.set('X-RateLimit-Limit', String(effectiveUserLimit));
        res.set('X-RateLimit-Remaining', String(Math.max(0, effectiveUserLimit - userCount)));
      } else {
        res.set('X-RateLimit-Limit', String(effectiveIpLimit));
        res.set('X-RateLimit-Remaining', String(Math.max(0, effectiveIpLimit - ipCount)));
      }

      res.set('X-RateLimit-Reset', String(Math.ceil((now + ipWindow) / 1000)));
      next();
    } catch (error) {
      console.error('[RateLimit] Combined limiter error:', error.message);
      next(); // Fail open
    }
  };
}

/**
 * Send rate limit exceeded response
 */
function sendRateLimitResponse(res, limit, remaining, windowMs, message) {
  const retryAfter = Math.ceil(windowMs / 1000);
  
  res.set('X-RateLimit-Limit', String(limit));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('Retry-After', String(retryAfter));

  return res.status(429).json({
    status: 'error',
    message: message || 'Too many requests, please try again later.',
    retryAfter,
  });
}

/**
 * Adaptive Rate Limiter
 * Adjusts limits based on server load
 */
function createAdaptiveLimiter(options = {}) {
  const {
    baseLimit = 100,
    minLimit = 10,
    maxLimit = 500,
    window = 60000,
    loadThresholds = {
      low: 0.3,    // Below 30% - increase limit
      high: 0.7,   // Above 70% - decrease limit
    },
    keyPrefix = 'ratelimit:adaptive',
    keyGenerator = (req) => req.ip,
  } = options;

  let currentLimit = baseLimit;
  let lastAdjustment = Date.now();
  const adjustmentInterval = 5000; // Adjust every 5 seconds

  // Monitor event loop lag as load indicator
  let eventLoopLag = 0;
  const lagSamples = [];
  
  setInterval(() => {
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      lagSamples.push(lag);
      if (lagSamples.length > 10) lagSamples.shift();
      eventLoopLag = lagSamples.reduce((a, b) => a + b, 0) / lagSamples.length;
    });
  }, 1000);

  return async function adaptiveRateLimit(req, res, next) {
    const now = Date.now();

    // Adjust limit based on load
    if (now - lastAdjustment > adjustmentInterval) {
      const load = Math.min(eventLoopLag / 100, 1); // Normalize to 0-1
      
      if (load < loadThresholds.low && currentLimit < maxLimit) {
        currentLimit = Math.min(currentLimit * 1.1, maxLimit);
      } else if (load > loadThresholds.high && currentLimit > minLimit) {
        currentLimit = Math.max(currentLimit * 0.9, minLimit);
      }
      
      lastAdjustment = now;
    }

    // Apply sliding window with current limit
    const identifier = keyGenerator(req);
    const key = `${keyPrefix}:${identifier}`;
    const windowStart = now - window;

    try {
      let count;
      if (redisService.isConnected) {
        count = await executeSlidingWindow(key, now, windowStart, window);
      } else {
        count = 0; // Fail open
      }

      const effectiveLimit = Math.floor(currentLimit);
      const remaining = Math.max(0, effectiveLimit - count);

      res.set('X-RateLimit-Limit', String(effectiveLimit));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + window) / 1000)));
      res.set('X-RateLimit-Load', eventLoopLag.toFixed(2));

      if (count > effectiveLimit) {
        const retryAfter = Math.ceil(window / 1000);
        res.set('Retry-After', String(retryAfter));

        return res.status(429).json({
          status: 'error',
          message: 'Server under high load. Please try again shortly.',
          retryAfter,
          serverLoad: 'high',
        });
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Adaptive limiter error:', error.message);
      next();
    }
  };
}

/**
 * Create default rate limiter for backward compatibility
 * Replaces the old in-memory rate limiter
 */
function createRateLimiter(options = {}) {
  const {
    window = '1m',
    max = 60,
    keyGenerator,
    skip,
  } = options;

  // Parse window string to milliseconds
  const windowMs = parseWindow(window);

  return createSlidingWindowLimiter({
    window: windowMs,
    max,
    keyGenerator: keyGenerator || ((req) => req.ip),
    skip: skip || (() => false),
  });
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window) {
  if (typeof window === 'number') return window;
  
  const match = window.match(/^(\d+)(s|m|h|d)?$/);
  if (!match) return 60000; // Default 1 minute
  
  const value = parseInt(match[1], 10);
  const unit = match[2] || 'm';
  
  const multipliers = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };
  
  return value * (multipliers[unit] || 60000);
}

module.exports = {
  createRateLimiter,
  createTokenBucketLimiter,
  createSlidingWindowLimiter,
  createCombinedLimiter,
  createAdaptiveLimiter,
};
