/**
 * Event Loop Optimization Utilities
 * 
 * Tools for optimizing Node.js event loop performance:
 * - Event loop lag monitoring
 * - setImmediate for I/O-bound work
 * - Async iteration helpers
 * - CPU-bound task scheduling
 */

const { AsyncLocalStorage } = require('async_hooks');

// ============================================
// Event Loop Lag Monitoring
// ============================================

class EventLoopMonitor {
  constructor(options = {}) {
    this.sampleInterval = options.sampleInterval || 1000;
    this.historySize = options.historySize || 60;
    this.threshold = options.threshold || 100; // ms
    
    this.lagHistory = [];
    this.timer = null;
    this.lastCheck = Date.now();
    this.isRunning = false;
    
    this.callbacks = {
      onLag: options.onLag || null,
      onThresholdExceeded: options.onThresholdExceeded || null,
    };
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastCheck = Date.now();
    
    this.timer = setInterval(() => {
      this._sample();
    }, this.sampleInterval);

    // Don't let the monitor prevent process exit
    this.timer.unref();
    
    console.log('[EventLoop] Monitor started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    console.log('[EventLoop] Monitor stopped');
  }

  /**
   * Sample event loop lag
   */
  _sample() {
    const now = Date.now();
    const expectedInterval = this.sampleInterval;
    const actualInterval = now - this.lastCheck;
    const lag = Math.max(0, actualInterval - expectedInterval);
    
    this.lagHistory.push({
      timestamp: now,
      lag,
    });

    // Keep history limited
    if (this.lagHistory.length > this.historySize) {
      this.lagHistory.shift();
    }

    this.lastCheck = now;

    // Callbacks
    if (this.callbacks.onLag) {
      this.callbacks.onLag(lag);
    }

    if (lag > this.threshold && this.callbacks.onThresholdExceeded) {
      this.callbacks.onThresholdExceeded(lag);
    }
  }

  /**
   * Get current lag
   */
  getCurrentLag() {
    if (this.lagHistory.length === 0) return 0;
    return this.lagHistory[this.lagHistory.length - 1].lag;
  }

  /**
   * Get average lag
   */
  getAverageLag() {
    if (this.lagHistory.length === 0) return 0;
    const total = this.lagHistory.reduce((sum, item) => sum + item.lag, 0);
    return total / this.lagHistory.length;
  }

  /**
   * Get max lag in history
   */
  getMaxLag() {
    if (this.lagHistory.length === 0) return 0;
    return Math.max(...this.lagHistory.map(item => item.lag));
  }

  /**
   * Get statistics
   */
  getStats() {
    if (this.lagHistory.length === 0) {
      return {
        current: 0,
        average: 0,
        max: 0,
        samples: 0,
        isHealthy: true,
      };
    }

    const lags = this.lagHistory.map(item => item.lag);
    const sorted = [...lags].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      current: this.getCurrentLag(),
      average: this.getAverageLag(),
      max: this.getMaxLag(),
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
      samples: this.lagHistory.length,
      isHealthy: this.getAverageLag() < this.threshold,
    };
  }
}

// Singleton monitor instance
const monitor = new EventLoopMonitor();

// ============================================
// Async Iteration Helpers
// ============================================

/**
 * Process array in batches with event loop yielding
 */
async function processBatch(items, batchSize, processor) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    // Yield to event loop between batches
    await yieldToEventLoop();
  }
  
  return results;
}

/**
 * Process items with concurrency limit
 */
async function processWithConcurrency(items, concurrency, processor) {
  const results = new Array(items.length);
  let index = 0;
  
  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await processor(items[currentIndex], currentIndex);
      
      // Yield occasionally
      if (currentIndex % 10 === 0) {
        await yieldToEventLoop();
      }
    }
  };

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());
  
  await Promise.all(workers);
  return results;
}

/**
 * Yield to event loop
 */
function yieldToEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Yield with microtask (faster but doesn't yield to I/O)
 */
function yieldMicrotask() {
  return new Promise(resolve => process.nextTick(resolve));
}

/**
 * Defer execution to next event loop iteration
 */
function defer(fn) {
  setImmediate(fn);
}

/**
 * Schedule a function to run at a specific time
 */
function scheduleAt(fn, targetTime) {
  const delay = Math.max(0, targetTime - Date.now());
  return setTimeout(fn, delay);
}

// ============================================
// CPU-Bound Task Scheduling
// ============================================

/**
 * Run a CPU-intensive task in chunks
 */
async function runInChunks(task, chunkSize = 1000) {
  let iteration = 0;
  
  while (true) {
    const result = task(iteration, chunkSize);
    
    if (result.done) {
      return result.value;
    }
    
    iteration++;
    
    // Yield every chunk
    await yieldToEventLoop();
  }
}

/**
 * Create a chunked iterator
 */
function* chunkIterator(items, chunkSize) {
  for (let i = 0; i < items.length; i += chunkSize) {
    yield items.slice(i, i + chunkSize);
  }
}

// ============================================
// Request Context (AsyncLocalStorage)
// ============================================

const requestContext = new AsyncLocalStorage();

/**
 * Run function with request context
 */
function runWithContext(context, fn) {
  return requestContext.run(context, fn);
}

/**
 * Get current request context
 */
function getContext() {
  return requestContext.getStore();
}

/**
 * Express middleware to setup request context
 */
function contextMiddleware(req, res, next) {
  const context = {
    requestId: req.headers['x-request-id'] || generateRequestId(),
    startTime: Date.now(),
    userId: req.user?._id?.toString(),
    path: req.path,
    method: req.method,
  };

  runWithContext(context, () => {
    // Add request ID to response headers
    res.setHeader('X-Request-ID', context.requestId);
    next();
  });
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Exports
// ============================================

module.exports = {
  // Event loop monitoring
  EventLoopMonitor,
  monitor,
  
  // Async helpers
  processBatch,
  processWithConcurrency,
  yieldToEventLoop,
  yieldMicrotask,
  defer,
  scheduleAt,
  
  // CPU-bound tasks
  runInChunks,
  chunkIterator,
  
  // Request context
  runWithContext,
  getContext,
  contextMiddleware,
  requestContext,
  generateRequestId,
};
