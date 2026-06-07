/**
 * Redis Service - Distributed Caching with Cluster Support
 * 
 * Features:
 * - Redis Cluster support with automatic failover
 * - Cache-aside pattern with getOrSet
 * - Pub/Sub for cache invalidation across instances
 * - Distributed locks using Redlock algorithm
 * - Graceful degradation when Redis unavailable
 */

const Redis = require('ioredis');
const crypto = require('crypto');

class RedisService {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
    this.locks = new Map();
    this.localCache = new Map(); // Fallback when Redis unavailable
    this.defaultTTL = 900; // 15 minutes in seconds
    this.lockTTL = 30000; // 30 seconds for locks
    this.retryAttempts = 3;
    this.retryDelay = 100;
  }

  /**
   * Initialize Redis connection with cluster or standalone mode
   */
  async connect() {
    const redisConfig = this._getConfig();

    try {
      if (process.env.REDIS_CLUSTER_NODES) {
        // Cluster mode
        const nodes = process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.trim().split(':');
          return { host, port: parseInt(port, 10) };
        });

        this.client = new Redis.Cluster(nodes, {
          redisOptions: {
            password: process.env.REDIS_PASSWORD,
            tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
          },
          clusterRetryStrategy: (times) => {
            if (times > 10) return null;
            return Math.min(times * 100, 3000);
          },
          enableReadyCheck: true,
          scaleReads: 'slave', // Read from replicas for better distribution
        });
      } else {
        // Standalone mode
        this.client = new Redis({
          ...redisConfig,
          retryStrategy: (times) => {
            if (times > 10) {
              console.error('[Redis] Max retry attempts reached');
              return null;
            }
            const delay = Math.min(times * 100, 3000);
            console.log(`[Redis] Retrying connection in ${delay}ms...`);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        });

        // Create separate connections for pub/sub
        this.subscriber = new Redis(redisConfig);
        this.publisher = new Redis(redisConfig);
      }

      this._setupEventHandlers();
      await this._waitForConnection();
      await this._setupPubSub();

      console.log('[Redis] Connected successfully');
      return true;
    } catch (error) {
      console.error('[Redis] Connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get Redis configuration from environment
   */
  _getConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB, 10) || 0,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'tradewise:',
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
  }

  /**
   * Setup event handlers for connection management
   */
  _setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('[Redis] Connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      console.log('[Redis] Ready to accept commands');
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      console.log('[Redis] Connection closed');
    });

    this.client.on('reconnecting', (delay) => {
      console.log(`[Redis] Reconnecting in ${delay}ms...`);
    });

    this.client.on('end', () => {
      this.isConnected = false;
      console.log('[Redis] Connection ended');
    });
  }

  /**
   * Wait for Redis connection to be ready
   */
  _waitForConnection(timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (this.client.status === 'ready') {
        this.isConnected = true;
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, timeout);

      this.client.once('ready', () => {
        clearTimeout(timer);
        this.isConnected = true;
        resolve();
      });

      this.client.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Setup Pub/Sub for cache invalidation
   */
  async _setupPubSub() {
    if (!this.subscriber) return;

    const channel = 'tradewise:cache:invalidate';
    
    await this.subscriber.subscribe(channel);
    
    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const { pattern, instanceId } = JSON.parse(message);
          // Don't invalidate if this instance sent the message
          if (instanceId !== this._getInstanceId()) {
            this._invalidateLocalCache(pattern);
          }
        } catch (error) {
          console.error('[Redis] Pub/Sub message parse error:', error);
        }
      }
    });

    console.log('[Redis] Pub/Sub channel subscribed:', channel);
  }

  /**
   * Get unique instance ID for this process
   */
  _getInstanceId() {
    if (!this._instanceId) {
      this._instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return this._instanceId;
  }

  /**
   * Generate cache key from namespace and arguments
   */
  generateKey(namespace, ...args) {
    const serialized = args.map(a => {
      if (typeof a === 'object' && a !== null) {
        return JSON.stringify(a);
      }
      return String(a);
    }).join('|');
    
    const hash = crypto.createHash('md5').update(serialized).digest('hex');
    return `${namespace}:${hash}`;
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.isConnected) {
      return this.localCache.get(key)?.data || null;
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('[Redis] Get error:', error.message);
      return this.localCache.get(key)?.data || null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttlSeconds = this.defaultTTL) {
    // Always update local cache for fallback
    this.localCache.set(key, {
      data: value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });

    if (!this.isConnected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('[Redis] Set error:', error.message);
      return false;
    }
  }

  /**
   * Cache-aside pattern: Get from cache or compute and store
   */
  async getOrSet(key, fetchFn, ttlSeconds = this.defaultTTL) {
    // Try to get from cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    // Compute the value
    const data = await fetchFn();

    // Store in cache (don't await to not block response)
    this.set(key, data, ttlSeconds).catch(err => {
      console.error('[Redis] Background set error:', err.message);
    });

    return { data, fromCache: false };
  }

  /**
   * Cache-aside with stale-while-revalidate pattern
   */
  async getOrSetSWR(key, fetchFn, ttlSeconds = this.defaultTTL, staleTTL = 60) {
    const cached = await this.get(key);
    
    if (cached !== null) {
      // Check if data is stale but still usable
      const metadata = await this.get(`${key}:meta`);
      const isStale = metadata && Date.now() > metadata.staleAt;
      
      if (isStale) {
        // Return stale data immediately, refresh in background
        setImmediate(async () => {
          try {
            const fresh = await fetchFn();
            await this.set(key, fresh, ttlSeconds);
            await this.set(`${key}:meta`, {
              staleAt: Date.now() + (staleTTL * 1000),
            }, ttlSeconds);
          } catch (error) {
            console.error('[Redis] SWR background refresh error:', error.message);
          }
        });
      }
      
      return { data: cached, fromCache: true, stale: isStale };
    }

    // No cached data, must fetch
    const data = await fetchFn();
    await this.set(key, data, ttlSeconds);
    await this.set(`${key}:meta`, {
      staleAt: Date.now() + (staleTTL * 1000),
    }, ttlSeconds);

    return { data, fromCache: false, stale: false };
  }

  /**
   * Delete a key from cache
   */
  async del(key) {
    this.localCache.delete(key);
    
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('[Redis] Del error:', error.message);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern) {
    this._invalidateLocalCache(pattern);

    if (!this.isConnected) {
      return 0;
    }

    try {
      let cursor = '0';
      let totalDeleted = 0;

      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      return totalDeleted;
    } catch (error) {
      console.error('[Redis] DelPattern error:', error.message);
      return 0;
    }
  }

  /**
   * Invalidate cache and notify other instances via Pub/Sub
   */
  async invalidate(pattern) {
    this._invalidateLocalCache(pattern);

    if (!this.isConnected) {
      return;
    }

    try {
      await this.delPattern(pattern);

      // Notify other instances
      if (this.publisher) {
        await this.publisher.publish('tradewise:cache:invalidate', JSON.stringify({
          pattern,
          instanceId: this._getInstanceId(),
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error('[Redis] Invalidate error:', error.message);
    }
  }

  /**
   * Invalidate local cache by pattern
   */
  _invalidateLocalCache(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.localCache.keys()) {
      if (regex.test(key)) {
        this.localCache.delete(key);
      }
    }
  }

  /**
   * Acquire distributed lock using Redlock algorithm
   */
  async acquireLock(resource, ttlMs = this.lockTTL) {
    const lockKey = `lock:${resource}`;
    const lockValue = `${this._getInstanceId()}:${Date.now()}`;

    if (!this.isConnected) {
      // Fallback to local lock
      if (this.locks.has(resource)) {
        return null;
      }
      this.locks.set(resource, { value: lockValue, expiresAt: Date.now() + ttlMs });
      return { resource, value: lockValue, release: () => this.locks.delete(resource) };
    }

    try {
      // SET NX with expiry for atomic lock acquisition
      const result = await this.client.set(lockKey, lockValue, 'PX', ttlMs, 'NX');

      if (result === 'OK') {
        return {
          resource,
          value: lockValue,
          release: () => this.releaseLock(resource, lockValue),
          extend: (additionalMs) => this.extendLock(resource, lockValue, additionalMs),
        };
      }

      return null; // Lock not acquired
    } catch (error) {
      console.error('[Redis] AcquireLock error:', error.message);
      return null;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(resource, lockValue) {
    const lockKey = `lock:${resource}`;

    // Local lock cleanup
    const localLock = this.locks.get(resource);
    if (localLock && localLock.value === lockValue) {
      this.locks.delete(resource);
    }

    if (!this.isConnected) {
      return true;
    }

    try {
      // Lua script for atomic check-and-delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, 1, lockKey, lockValue);
      return result === 1;
    } catch (error) {
      console.error('[Redis] ReleaseLock error:', error.message);
      return false;
    }
  }

  /**
   * Extend lock TTL
   */
  async extendLock(resource, lockValue, additionalMs) {
    const lockKey = `lock:${resource}`;

    if (!this.isConnected) {
      const localLock = this.locks.get(resource);
      if (localLock && localLock.value === lockValue) {
        localLock.expiresAt += additionalMs;
        return true;
      }
      return false;
    }

    try {
      // Lua script for atomic check-and-extend
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, 1, lockKey, lockValue, additionalMs);
      return result === 1;
    } catch (error) {
      console.error('[Redis] ExtendLock error:', error.message);
      return false;
    }
  }

  /**
   * Increment counter atomically
   */
  async incr(key, amount = 1) {
    if (!this.isConnected) {
      const current = this.localCache.get(key)?.data || 0;
      this.localCache.set(key, { data: current + amount, expiresAt: Infinity });
      return current + amount;
    }

    try {
      if (amount === 1) {
        return await this.client.incr(key);
      }
      return await this.client.incrby(key, amount);
    } catch (error) {
      console.error('[Redis] Incr error:', error.message);
      return 0;
    }
  }

  /**
   * Increment counter with expiry
   */
  async incrWithExpiry(key, amount = 1, ttlSeconds = 60) {
    if (!this.isConnected) {
      const current = this.localCache.get(key)?.data || 0;
      this.localCache.set(key, { data: current + amount, expiresAt: Date.now() + (ttlSeconds * 1000) });
      return current + amount;
    }

    try {
      const multi = this.client.multi();
      multi.incrby(key, amount);
      multi.expire(key, ttlSeconds);
      const results = await multi.exec();
      return results[0][1];
    } catch (error) {
      console.error('[Redis] IncrWithExpiry error:', error.message);
      return 0;
    }
  }

  /**
   * Add to sorted set (for rate limiting)
   */
  async zadd(key, score, member) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.zadd(key, score, member);
      return true;
    } catch (error) {
      console.error('[Redis] Zadd error:', error.message);
      return false;
    }
  }

  /**
   * Remove old entries from sorted set
   */
  async zremrangebyscore(key, min, max) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      return await this.client.zremrangebyscore(key, min, max);
    } catch (error) {
      console.error('[Redis] Zremrangebyscore error:', error.message);
      return 0;
    }
  }

  /**
   * Count entries in sorted set within score range
   */
  async zcount(key, min, max) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      return await this.client.zcount(key, min, max);
    } catch (error) {
      console.error('[Redis] Zcount error:', error.message);
      return 0;
    }
  }

  /**
   * Set expiry on a key
   */
  async expire(key, ttlSeconds) {
    if (!this.isConnected) {
      const entry = this.localCache.get(key);
      if (entry) {
        entry.expiresAt = Date.now() + (ttlSeconds * 1000);
      }
      return true;
    }

    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error('[Redis] Expire error:', error.message);
      return false;
    }
  }

  /**
   * Check if Redis is healthy
   */
  async ping() {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection status and stats
   */
  async getStatus() {
    const status = {
      connected: this.isConnected,
      localCacheSize: this.localCache.size,
      activeLocks: this.locks.size,
    };

    if (this.isConnected) {
      try {
        const info = await this.client.info('stats');
        const lines = info.split('\r\n');
        const stats = {};
        lines.forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) {
            stats[key] = value;
          }
        });
        status.redisStats = {
          connectedClients: stats.connected_clients,
          usedMemory: stats.used_memory_human,
          totalCommands: stats.total_commands_processed,
          hitRate: stats.keyspace_hits && stats.keyspace_misses
            ? (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2) + '%'
            : 'N/A',
        };
      } catch (error) {
        status.redisStats = { error: error.message };
      }
    }

    return status;
  }

  /**
   * Cleanup local cache of expired entries
   */
  cleanupLocalCache() {
    const now = Date.now();
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.localCache.delete(key);
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    console.log('[Redis] Disconnecting...');

    if (this.subscriber) {
      await this.subscriber.quit();
    }

    if (this.publisher) {
      await this.publisher.quit();
    }

    if (this.client) {
      await this.client.quit();
    }

    this.isConnected = false;
    this.localCache.clear();
    this.locks.clear();

    console.log('[Redis] Disconnected');
  }
}

// Export singleton instance
const redisService = new RedisService();

// Cleanup interval for local cache
setInterval(() => {
  redisService.cleanupLocalCache();
}, 60000);

module.exports = redisService;
