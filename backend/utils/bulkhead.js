/**
 * Bulkhead Pattern Implementation
 * 
 * Isolates failures and limits concurrent requests:
 * - Semaphore-based concurrency control
 * - Request queuing with timeout
 * - Separate pools for different services
 */

/**
 * Semaphore implementation for concurrency limiting
 */
class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.currentCount = 0;
    this.queue = [];
  }

  async acquire(timeout = 30000) {
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.currentCount < this.maxConcurrent) {
          this.currentCount++;
          resolve();
          return true;
        }
        return false;
      };

      if (tryAcquire()) return;

      // Queue the request
      const queueEntry = { resolve, reject, tryAcquire };
      this.queue.push(queueEntry);

      // Setup timeout
      const timer = setTimeout(() => {
        const index = this.queue.indexOf(queueEntry);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new BulkheadTimeoutError('Timeout waiting for semaphore'));
        }
      }, timeout);

      queueEntry.timer = timer;
    });
  }

  release() {
    this.currentCount--;
    this._processQueue();
  }

  _processQueue() {
    while (this.queue.length > 0 && this.currentCount < this.maxConcurrent) {
      const entry = this.queue.shift();
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      this.currentCount++;
      entry.resolve();
    }
  }

  getStatus() {
    return {
      current: this.currentCount,
      max: this.maxConcurrent,
      queued: this.queue.length,
      available: this.maxConcurrent - this.currentCount,
    };
  }
}

/**
 * Custom error for bulkhead timeout
 */
class BulkheadTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BulkheadTimeoutError';
    this.code = 'BULKHEAD_TIMEOUT';
  }
}

/**
 * Custom error for bulkhead rejection
 */
class BulkheadRejectError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BulkheadRejectError';
    this.code = 'BULKHEAD_REJECT';
  }
}

/**
 * Bulkhead class for isolating service calls
 */
class Bulkhead {
  constructor(name, options = {}) {
    this.name = name;
    this.maxConcurrent = options.maxConcurrent || 10;
    this.maxQueue = options.maxQueue || 100;
    this.timeout = options.timeout || 30000;
    
    this.semaphore = new Semaphore(this.maxConcurrent);
    this.stats = {
      executions: 0,
      successes: 0,
      failures: 0,
      rejections: 0,
      timeouts: 0,
    };
  }

  /**
   * Execute function within bulkhead
   */
  async execute(fn) {
    // Check queue limit
    if (this.semaphore.queue.length >= this.maxQueue) {
      this.stats.rejections++;
      throw new BulkheadRejectError(`Bulkhead ${this.name} queue is full`);
    }

    try {
      await this.semaphore.acquire(this.timeout);
    } catch (error) {
      if (error instanceof BulkheadTimeoutError) {
        this.stats.timeouts++;
      }
      throw error;
    }

    this.stats.executions++;

    try {
      const result = await fn();
      this.stats.successes++;
      return result;
    } catch (error) {
      this.stats.failures++;
      throw error;
    } finally {
      this.semaphore.release();
    }
  }

  /**
   * Get bulkhead status
   */
  getStatus() {
    return {
      name: this.name,
      config: {
        maxConcurrent: this.maxConcurrent,
        maxQueue: this.maxQueue,
        timeout: this.timeout,
      },
      semaphore: this.semaphore.getStatus(),
      stats: {
        ...this.stats,
        successRate: this.stats.executions > 0
          ? ((this.stats.successes / this.stats.executions) * 100).toFixed(2) + '%'
          : 'N/A',
      },
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      executions: 0,
      successes: 0,
      failures: 0,
      rejections: 0,
      timeouts: 0,
    };
  }
}

// Bulkhead registry
const bulkheads = new Map();

// Default configurations for different services
const BULKHEAD_CONFIGS = {
  gemini: {
    maxConcurrent: 5,    // Limit concurrent Gemini API calls
    maxQueue: 50,
    timeout: 60000,
  },
  finbert: {
    maxConcurrent: 10,
    maxQueue: 100,
    timeout: 30000,
  },
  cohere: {
    maxConcurrent: 5,
    maxQueue: 50,
    timeout: 30000,
  },
  email: {
    maxConcurrent: 5,
    maxQueue: 200,
    timeout: 60000,
  },
  database: {
    maxConcurrent: 50,
    maxQueue: 500,
    timeout: 10000,
  },
  cpu_intensive: {
    maxConcurrent: 2,    // Limit CPU-bound tasks
    maxQueue: 20,
    timeout: 120000,
  },
};

/**
 * Get or create a bulkhead
 */
function getBulkhead(name, options = {}) {
  if (!bulkheads.has(name)) {
    const config = {
      ...BULKHEAD_CONFIGS[name],
      ...options,
    };
    bulkheads.set(name, new Bulkhead(name, config));
  }
  return bulkheads.get(name);
}

/**
 * Execute with bulkhead protection
 */
async function withBulkhead(name, fn, options = {}) {
  const bulkhead = getBulkhead(name, options);
  return bulkhead.execute(fn);
}

/**
 * Create a wrapped function with bulkhead
 */
function wrapWithBulkhead(name, fn, options = {}) {
  const bulkhead = getBulkhead(name, options);
  
  return async (...args) => {
    return bulkhead.execute(() => fn(...args));
  };
}

/**
 * Get all bulkhead statuses
 */
function getAllStatus() {
  const status = {};
  for (const [name, bulkhead] of bulkheads) {
    status[name] = bulkhead.getStatus();
  }
  return status;
}

/**
 * Get status of a specific bulkhead
 */
function getStatus(name) {
  const bulkhead = bulkheads.get(name);
  if (!bulkhead) {
    return { exists: false, name };
  }
  return bulkhead.getStatus();
}

/**
 * Health check - returns true if no bulkheads are at capacity
 */
function healthCheck() {
  for (const [name, bulkhead] of bulkheads) {
    const status = bulkhead.semaphore.getStatus();
    
    // Check if bulkhead is at capacity
    if (status.available === 0 && status.queued > 0) {
      return {
        healthy: false,
        reason: `Bulkhead ${name} is at capacity`,
        bulkhead: name,
        queued: status.queued,
      };
    }
    
    // Check if queue is getting full
    if (status.queued > bulkhead.maxQueue * 0.8) {
      return {
        healthy: false,
        reason: `Bulkhead ${name} queue is 80% full`,
        bulkhead: name,
        queued: status.queued,
        maxQueue: bulkhead.maxQueue,
      };
    }
  }
  
  return { healthy: true };
}

/**
 * Reset all bulkhead stats
 */
function resetAllStats() {
  for (const bulkhead of bulkheads.values()) {
    bulkhead.resetStats();
  }
}

/**
 * Shutdown - reject all queued requests
 */
function shutdown() {
  for (const [name, bulkhead] of bulkheads) {
    const queue = bulkhead.semaphore.queue;
    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(new Error('Bulkhead shutting down'));
    }
  }
  bulkheads.clear();
}

module.exports = {
  Bulkhead,
  Semaphore,
  BulkheadTimeoutError,
  BulkheadRejectError,
  getBulkhead,
  withBulkhead,
  wrapWithBulkhead,
  getAllStatus,
  getStatus,
  healthCheck,
  resetAllStats,
  shutdown,
  BULKHEAD_CONFIGS,
};
