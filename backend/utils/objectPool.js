/**
 * Object Pool Implementation
 * 
 * Memory-efficient object pooling for high-throughput scenarios:
 * - Pre-allocated object pools
 * - Reusable context objects
 * - Automatic pool expansion
 */

const genericPool = require('generic-pool');

// ============================================
// Generic Object Pool
// ============================================

class ObjectPool {
  constructor(options = {}) {
    const {
      name = 'default',
      create = () => ({}),
      reset = (obj) => obj,
      validate = () => true,
      min = 5,
      max = 50,
      acquireTimeoutMillis = 5000,
      idleTimeoutMillis = 30000,
      evictionRunIntervalMillis = 1000,
    } = options;

    this.name = name;
    this.create = create;
    this.reset = reset;

    this.pool = genericPool.createPool({
      create: async () => {
        const obj = await this.create();
        obj.__pooled = true;
        obj.__poolName = name;
        return obj;
      },
      destroy: async (obj) => {
        obj.__pooled = false;
      },
      validate: async (obj) => {
        return obj.__pooled && validate(obj);
      },
    }, {
      min,
      max,
      acquireTimeoutMillis,
      idleTimeoutMillis,
      evictionRunIntervalMillis,
      testOnBorrow: true,
    });

    // Stats tracking
    this.stats = {
      acquires: 0,
      releases: 0,
      creates: 0,
      destroys: 0,
      errors: 0,
    };
  }

  /**
   * Acquire an object from the pool
   */
  async acquire() {
    try {
      const obj = await this.pool.acquire();
      this.stats.acquires++;
      return obj;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Release an object back to the pool
   */
  async release(obj) {
    try {
      // Reset the object before releasing
      this.reset(obj);
      await this.pool.release(obj);
      this.stats.releases++;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Use an object from the pool with automatic release
   */
  async use(fn) {
    const obj = await this.acquire();
    try {
      return await fn(obj);
    } finally {
      await this.release(obj);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      name: this.name,
      size: this.pool.size,
      available: this.pool.available,
      borrowed: this.pool.borrowed,
      pending: this.pool.pending,
      ...this.stats,
    };
  }

  /**
   * Drain and shutdown the pool
   */
  async drain() {
    await this.pool.drain();
    await this.pool.clear();
  }
}

// ============================================
// Pre-configured Pools
// ============================================

// Buffer pool for large data processing
const bufferPool = new ObjectPool({
  name: 'buffer',
  create: () => Buffer.alloc(64 * 1024), // 64KB buffers
  reset: (buf) => {
    buf.fill(0);
    return buf;
  },
  min: 10,
  max: 100,
});

// Trade context pool
const tradeContextPool = new ObjectPool({
  name: 'trade-context',
  create: () => ({
    userId: null,
    tradeId: null,
    symbol: null,
    direction: null,
    entryPrice: null,
    quantity: null,
    reason: null,
    emotionAnalysis: null,
    patterns: [],
    violations: [],
    metadata: {},
  }),
  reset: (ctx) => {
    ctx.userId = null;
    ctx.tradeId = null;
    ctx.symbol = null;
    ctx.direction = null;
    ctx.entryPrice = null;
    ctx.quantity = null;
    ctx.reason = null;
    ctx.emotionAnalysis = null;
    ctx.patterns.length = 0;
    ctx.violations.length = 0;
    ctx.metadata = {};
    return ctx;
  },
  min: 20,
  max: 200,
});

// AI request context pool
const aiContextPool = new ObjectPool({
  name: 'ai-context',
  create: () => ({
    provider: null,
    operation: null,
    prompt: null,
    response: null,
    startTime: null,
    endTime: null,
    tokens: { input: 0, output: 0 },
    error: null,
    cached: false,
  }),
  reset: (ctx) => {
    ctx.provider = null;
    ctx.operation = null;
    ctx.prompt = null;
    ctx.response = null;
    ctx.startTime = null;
    ctx.endTime = null;
    ctx.tokens.input = 0;
    ctx.tokens.output = 0;
    ctx.error = null;
    ctx.cached = false;
    return ctx;
  },
  min: 10,
  max: 50,
});

// Array pool for batch operations
const arrayPool = new ObjectPool({
  name: 'array',
  create: () => [],
  reset: (arr) => {
    arr.length = 0;
    return arr;
  },
  min: 50,
  max: 500,
});

// ============================================
// Ring Buffer (Lock-free circular buffer)
// ============================================

class RingBuffer {
  constructor(capacity = 1024) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.size = 0;
  }

  /**
   * Write to the buffer (overwrites oldest if full)
   */
  write(item) {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer is full, move read index
      this.readIndex = (this.readIndex + 1) % this.capacity;
    }
    
    return true;
  }

  /**
   * Read from the buffer
   */
  read() {
    if (this.size === 0) {
      return null;
    }

    const item = this.buffer[this.readIndex];
    this.buffer[this.readIndex] = null; // Help GC
    this.readIndex = (this.readIndex + 1) % this.capacity;
    this.size--;
    
    return item;
  }

  /**
   * Peek at the next item without removing
   */
  peek() {
    if (this.size === 0) {
      return null;
    }
    return this.buffer[this.readIndex];
  }

  /**
   * Get all items as array (non-destructive)
   */
  toArray() {
    const result = [];
    let index = this.readIndex;
    
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[index]);
      index = (index + 1) % this.capacity;
    }
    
    return result;
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer.fill(null);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.size = 0;
  }

  isEmpty() {
    return this.size === 0;
  }

  isFull() {
    return this.size === this.capacity;
  }

  getSize() {
    return this.size;
  }

  getCapacity() {
    return this.capacity;
  }
}

// ============================================
// Exports
// ============================================

module.exports = {
  ObjectPool,
  RingBuffer,
  
  // Pre-configured pools
  bufferPool,
  tradeContextPool,
  aiContextPool,
  arrayPool,
  
  // Get all pool stats
  getAllPoolStats: () => ({
    buffer: bufferPool.getStats(),
    tradeContext: tradeContextPool.getStats(),
    aiContext: aiContextPool.getStats(),
    array: arrayPool.getStats(),
  }),
  
  // Drain all pools
  drainAllPools: async () => {
    await Promise.all([
      bufferPool.drain(),
      tradeContextPool.drain(),
      aiContextPool.drain(),
      arrayPool.drain(),
    ]);
  },
};
