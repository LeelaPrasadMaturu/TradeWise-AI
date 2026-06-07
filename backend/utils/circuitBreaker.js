/**
 * Circuit Breaker Pattern Implementation
 * 
 * Fault-tolerant service communication for AI services:
 * - Separate breakers for Gemini, FinBERT, Cohere, CoinGecko
 * - Configurable thresholds per service
 * - Fallback strategies
 * - Health check endpoints
 */

const CircuitBreaker = require('opossum');
const EventEmitter = require('events');

// Circuit breaker registry
const breakers = new Map();
const breakerEvents = new EventEmitter();

// Default options for circuit breakers
const DEFAULT_OPTIONS = {
  timeout: 15000,              // 15 seconds timeout
  errorThresholdPercentage: 50, // Trip when 50% of requests fail
  resetTimeout: 30000,          // Try again after 30 seconds
  volumeThreshold: 5,           // Minimum requests before tripping
  rollingCountTimeout: 10000,   // Rolling window for stats
  rollingCountBuckets: 10,      // Number of buckets in rolling window
};

// Service-specific configurations
const SERVICE_CONFIGS = {
  gemini: {
    timeout: 30000,             // Gemini can be slow
    errorThresholdPercentage: 40,
    resetTimeout: 60000,
    volumeThreshold: 3,
    name: 'Gemini AI',
  },
  finbert: {
    timeout: 20000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
    name: 'FinBERT (HuggingFace)',
  },
  cohere: {
    timeout: 15000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
    name: 'Cohere AI',
  },
  coingecko: {
    timeout: 10000,
    errorThresholdPercentage: 60,
    resetTimeout: 20000,
    volumeThreshold: 10,
    name: 'CoinGecko API',
  },
  mongodb: {
    timeout: 5000,
    errorThresholdPercentage: 30,
    resetTimeout: 10000,
    volumeThreshold: 3,
    name: 'MongoDB',
  },
};

// Fallback functions registry
const fallbacks = new Map();

/**
 * Create a circuit breaker for a service
 */
function createCircuitBreaker(serviceName, asyncFn, options = {}) {
  const config = SERVICE_CONFIGS[serviceName] || {};
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...config,
    ...options,
    name: options.name || config.name || serviceName,
  };

  const breaker = new CircuitBreaker(asyncFn, mergedOptions);

  // Setup event handlers
  setupBreakerEvents(serviceName, breaker);

  // Store in registry
  breakers.set(serviceName, breaker);

  console.log(`[CircuitBreaker] Created breaker for ${serviceName}`);

  return breaker;
}

/**
 * Setup event handlers for a circuit breaker
 */
function setupBreakerEvents(serviceName, breaker) {
  breaker.on('success', (result, latencyMs) => {
    breakerEvents.emit('success', { service: serviceName, latencyMs });
  });

  breaker.on('failure', (error, latencyMs) => {
    console.warn(`[CircuitBreaker:${serviceName}] Failure:`, error.message);
    breakerEvents.emit('failure', { service: serviceName, error: error.message, latencyMs });
  });

  breaker.on('timeout', () => {
    console.warn(`[CircuitBreaker:${serviceName}] Timeout`);
    breakerEvents.emit('timeout', { service: serviceName });
  });

  breaker.on('reject', () => {
    console.warn(`[CircuitBreaker:${serviceName}] Rejected (circuit open)`);
    breakerEvents.emit('reject', { service: serviceName });
  });

  breaker.on('open', () => {
    console.error(`[CircuitBreaker:${serviceName}] OPEN - Service failing`);
    breakerEvents.emit('open', { service: serviceName });
  });

  breaker.on('halfOpen', () => {
    console.log(`[CircuitBreaker:${serviceName}] HALF-OPEN - Testing recovery`);
    breakerEvents.emit('halfOpen', { service: serviceName });
  });

  breaker.on('close', () => {
    console.log(`[CircuitBreaker:${serviceName}] CLOSED - Service recovered`);
    breakerEvents.emit('close', { service: serviceName });
  });

  breaker.on('fallback', (result) => {
    console.log(`[CircuitBreaker:${serviceName}] Fallback used`);
    breakerEvents.emit('fallback', { service: serviceName, result });
  });
}

/**
 * Register a fallback function for a service
 */
function registerFallback(serviceName, fallbackFn) {
  fallbacks.set(serviceName, fallbackFn);
  
  const breaker = breakers.get(serviceName);
  if (breaker) {
    breaker.fallback(fallbackFn);
  }
}

/**
 * Get or create a circuit breaker
 */
function getBreaker(serviceName) {
  return breakers.get(serviceName);
}

/**
 * Execute function with circuit breaker protection
 */
async function withCircuitBreaker(serviceName, asyncFn, ...args) {
  let breaker = breakers.get(serviceName);
  
  if (!breaker) {
    breaker = createCircuitBreaker(serviceName, asyncFn);
  }

  try {
    return await breaker.fire(...args);
  } catch (error) {
    // Check for fallback
    const fallbackFn = fallbacks.get(serviceName);
    if (fallbackFn) {
      console.log(`[CircuitBreaker:${serviceName}] Using fallback`);
      return fallbackFn(...args);
    }
    throw error;
  }
}

/**
 * Create wrapped function with circuit breaker
 */
function wrapWithCircuitBreaker(serviceName, asyncFn, options = {}) {
  const breaker = createCircuitBreaker(serviceName, asyncFn, options);
  
  // Register fallback if provided
  if (options.fallback) {
    breaker.fallback(options.fallback);
    fallbacks.set(serviceName, options.fallback);
  }

  // Return wrapped function
  return async (...args) => {
    try {
      return await breaker.fire(...args);
    } catch (error) {
      if (error.code === 'EOPENBREAKER') {
        throw new CircuitOpenError(serviceName, error);
      }
      throw error;
    }
  };
}

/**
 * Custom error for open circuit
 */
class CircuitOpenError extends Error {
  constructor(serviceName, originalError) {
    super(`Circuit breaker open for ${serviceName}`);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.originalError = originalError;
    this.code = 'CIRCUIT_OPEN';
  }
}

/**
 * Get circuit breaker status for all services
 */
function getAllStatus() {
  const status = {};
  
  for (const [name, breaker] of breakers) {
    status[name] = getBreakerStatus(breaker);
  }
  
  return status;
}

/**
 * Get status of a specific breaker
 */
function getBreakerStatus(breaker) {
  const stats = breaker.stats;
  
  return {
    name: breaker.name,
    state: breaker.opened ? 'OPEN' : (breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED'),
    enabled: breaker.enabled,
    stats: {
      fires: stats.fires,
      successes: stats.successes,
      failures: stats.failures,
      rejects: stats.rejects,
      timeouts: stats.timeouts,
      fallbacks: stats.fallbacks,
      successRate: stats.fires > 0 
        ? ((stats.successes / stats.fires) * 100).toFixed(2) + '%'
        : 'N/A',
      latencyMean: stats.latencyMean?.toFixed(2) + 'ms' || 'N/A',
      latencyP99: stats.percentiles?.[99]?.toFixed(2) + 'ms' || 'N/A',
    },
  };
}

/**
 * Get status for a specific service
 */
function getServiceStatus(serviceName) {
  const breaker = breakers.get(serviceName);
  if (!breaker) {
    return { exists: false, serviceName };
  }
  return getBreakerStatus(breaker);
}

/**
 * Reset a circuit breaker
 */
function resetBreaker(serviceName) {
  const breaker = breakers.get(serviceName);
  if (breaker) {
    breaker.close();
    console.log(`[CircuitBreaker:${serviceName}] Reset to closed`);
    return true;
  }
  return false;
}

/**
 * Disable a circuit breaker (let all requests through)
 */
function disableBreaker(serviceName) {
  const breaker = breakers.get(serviceName);
  if (breaker) {
    breaker.disable();
    console.log(`[CircuitBreaker:${serviceName}] Disabled`);
    return true;
  }
  return false;
}

/**
 * Enable a circuit breaker
 */
function enableBreaker(serviceName) {
  const breaker = breakers.get(serviceName);
  if (breaker) {
    breaker.enable();
    console.log(`[CircuitBreaker:${serviceName}] Enabled`);
    return true;
  }
  return false;
}

/**
 * Health check - returns true if all critical services are healthy
 */
function healthCheck(criticalServices = ['gemini', 'finbert', 'mongodb']) {
  for (const service of criticalServices) {
    const breaker = breakers.get(service);
    if (breaker && breaker.opened) {
      return {
        healthy: false,
        reason: `${service} circuit is open`,
        failedService: service,
      };
    }
  }
  
  return { healthy: true };
}

/**
 * Get event emitter for monitoring
 */
function getEventEmitter() {
  return breakerEvents;
}

/**
 * Shutdown all circuit breakers
 */
function shutdown() {
  for (const [name, breaker] of breakers) {
    breaker.shutdown();
    console.log(`[CircuitBreaker:${name}] Shutdown`);
  }
  breakers.clear();
  fallbacks.clear();
}

// Pre-configured AI service fallbacks
const AI_FALLBACKS = {
  gemini: (prompt) => ({
    response: 'AI analysis temporarily unavailable. Please try again shortly.',
    recommendations: [],
    fallback: true,
    cached: false,
  }),
  
  finbert: (text) => {
    // Simple keyword-based fallback for emotion detection
    const lowerText = text.toLowerCase();
    const positiveWords = ['profit', 'gain', 'bullish', 'confident', 'planned'];
    const negativeWords = ['loss', 'fear', 'panic', 'fomo', 'revenge', 'anxious'];
    
    let positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    let negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
    
    let label = 'neutral';
    if (positiveCount > negativeCount) label = 'positive';
    else if (negativeCount > positiveCount) label = 'negative';
    
    return {
      detected: label,
      confidence: 0.5,
      method: 'keyword_fallback',
      fallback: true,
    };
  },
  
  cohere: (term) => ({
    explanation: `Definition for "${term}" is temporarily unavailable. Please try again later.`,
    fallback: true,
  }),
  
  coingecko: (symbols) => ({
    prices: {},
    error: 'Price data temporarily unavailable',
    fallback: true,
  }),
};

module.exports = {
  createCircuitBreaker,
  registerFallback,
  getBreaker,
  withCircuitBreaker,
  wrapWithCircuitBreaker,
  getAllStatus,
  getServiceStatus,
  resetBreaker,
  disableBreaker,
  enableBreaker,
  healthCheck,
  getEventEmitter,
  shutdown,
  CircuitOpenError,
  SERVICE_CONFIGS,
  AI_FALLBACKS,
};
