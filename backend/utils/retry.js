/**
 * Retry Strategies
 * 
 * Configurable retry logic with:
 * - Exponential backoff with jitter
 * - Configurable max attempts
 * - Conditional retry based on error type
 * - Dead letter queue integration
 */

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,    // 1 second
  maxDelay: 30000,       // 30 seconds
  factor: 2,             // Exponential factor
  jitter: true,          // Add randomness to prevent thundering herd
  jitterFactor: 0.3,     // 30% jitter
  retryableErrors: null, // null = retry all errors
  onRetry: null,         // Callback on each retry
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt, config) {
  let delay = config.initialDelay * Math.pow(config.factor, attempt - 1);
  
  // Cap at max delay
  delay = Math.min(delay, config.maxDelay);
  
  // Add jitter
  if (config.jitter) {
    const jitterAmount = delay * config.jitterFactor;
    delay = delay - jitterAmount + (Math.random() * jitterAmount * 2);
  }
  
  return Math.round(delay);
}

/**
 * Check if error is retryable
 */
function isRetryable(error, config) {
  // If no retryable errors specified, retry all
  if (!config.retryableErrors) {
    return true;
  }

  // Check error code
  if (config.retryableErrors.includes(error.code)) {
    return true;
  }

  // Check error name
  if (config.retryableErrors.includes(error.name)) {
    return true;
  }

  // Check error message patterns
  for (const pattern of config.retryableErrors) {
    if (pattern instanceof RegExp && pattern.test(error.message)) {
      return true;
    }
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  let lastError;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt >= config.maxAttempts || !isRetryable(error, config)) {
        throw error;
      }
      
      // Calculate delay
      const delay = calculateDelay(attempt, config);
      
      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry({
          attempt,
          error,
          delay,
          maxAttempts: config.maxAttempts,
        });
      }
      
      console.log(`[Retry] Attempt ${attempt}/${config.maxAttempts} failed, retrying in ${delay}ms:`, error.message);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Create a retryable version of a function
 */
function withRetry(fn, options = {}) {
  return async (...args) => {
    return retry(() => fn(...args), options);
  };
}

/**
 * Retry with circuit breaker integration
 */
async function retryWithBreaker(fn, breaker, options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...options,
    // Don't retry if circuit is open
    retryableErrors: [
      ...(options.retryableErrors || []),
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'RATE_LIMIT',
    ],
  };

  return retry(async (attempt) => {
    // Check circuit state before attempting
    if (breaker?.opened) {
      throw new Error('Circuit breaker is open');
    }
    
    return fn(attempt);
  }, config);
}

/**
 * Predefined retry configurations for different scenarios
 */
const RETRY_CONFIGS = {
  // AI API calls - be patient, expensive operations
  aiApi: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
    retryableErrors: [
      'ETIMEDOUT',
      'ECONNRESET',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      /429/,  // Rate limited
      /500/,  // Server error
      /502/,  // Bad gateway
      /503/,  // Service unavailable
      /504/,  // Gateway timeout
    ],
  },

  // Database operations - quick retries
  database: {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 1000,
    factor: 2,
    jitter: true,
    retryableErrors: [
      'ECONNRESET',
      'MongoNetworkError',
      'MongoTimeoutError',
      /connection/i,
    ],
  },

  // External API calls
  externalApi: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    factor: 2,
    jitter: true,
    retryableErrors: [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      /429/,
      /5\d\d/,
    ],
  },

  // Email delivery
  email: {
    maxAttempts: 5,
    initialDelay: 5000,
    maxDelay: 60000,
    factor: 2,
    jitter: true,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ESOCKET',
      /temporarily/i,
      /try again/i,
    ],
  },

  // Quick retry for idempotent operations
  quick: {
    maxAttempts: 2,
    initialDelay: 100,
    maxDelay: 500,
    factor: 2,
    jitter: false,
  },

  // Aggressive retry for critical operations
  critical: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 60000,
    factor: 2,
    jitter: true,
  },
};

/**
 * Retry with dead letter queue support
 */
async function retryWithDLQ(fn, dlqFn, options = {}) {
  try {
    return await retry(fn, options);
  } catch (error) {
    // All retries exhausted, send to DLQ
    console.error('[Retry] All retries exhausted, sending to DLQ');
    
    if (dlqFn) {
      await dlqFn({
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack,
        },
        attempts: options.maxAttempts || DEFAULT_CONFIG.maxAttempts,
        timestamp: Date.now(),
      });
    }
    
    throw error;
  }
}

/**
 * Batch retry - retry multiple operations, collecting failures
 */
async function batchRetry(operations, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const results = [];
  const failures = [];
  
  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await retry(operations[i], config);
      results.push({ index: i, success: true, result });
    } catch (error) {
      failures.push({ index: i, success: false, error: error.message });
      results.push({ index: i, success: false, error: error.message });
    }
  }
  
  return {
    results,
    failures,
    successCount: results.filter(r => r.success).length,
    failureCount: failures.length,
  };
}

/**
 * Conditional retry based on response
 */
async function retryUntil(fn, condition, options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    maxAttempts: options.maxAttempts || 10,
    ...options,
  };
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      
      if (condition(result)) {
        return result;
      }
      
      if (attempt >= config.maxAttempts) {
        throw new Error('Condition not met after all retries');
      }
      
      const delay = calculateDelay(attempt, config);
      console.log(`[Retry] Condition not met, attempt ${attempt}/${config.maxAttempts}, waiting ${delay}ms`);
      await sleep(delay);
      
    } catch (error) {
      if (attempt >= config.maxAttempts || !isRetryable(error, config)) {
        throw error;
      }
      
      const delay = calculateDelay(attempt, config);
      await sleep(delay);
    }
  }
}

module.exports = {
  retry,
  withRetry,
  retryWithBreaker,
  retryWithDLQ,
  batchRetry,
  retryUntil,
  calculateDelay,
  isRetryable,
  sleep,
  RETRY_CONFIGS,
  DEFAULT_CONFIG,
};
