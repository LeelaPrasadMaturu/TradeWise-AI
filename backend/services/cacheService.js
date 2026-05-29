const crypto = require('crypto');

class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 15 * 60 * 1000;
    this._cleanupInterval = setInterval(() => this._cleanup(), 60 * 1000);
  }

  _hash(input) {
    return crypto.createHash('md5').update(String(input)).digest('hex');
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  generateKey(namespace, ...args) {
    const serialized = args.map(a => {
      if (typeof a === 'object' && a !== null) return JSON.stringify(a);
      return String(a);
    }).join('|');
    return `${namespace}:${this._hash(serialized)}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key, data, ttl) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  async wrap(key, fn, ttl) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.cache.clear();
  }
}

module.exports = new CacheService();
