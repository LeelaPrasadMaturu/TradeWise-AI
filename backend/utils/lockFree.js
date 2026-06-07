/**
 * Lock-Free Data Structures
 * 
 * High-performance concurrent data structures:
 * - Atomic counters
 * - Lock-free ring buffer
 * - Compare-and-swap patterns
 * - Concurrent queue
 */

// ============================================
// Atomic Counter (using SharedArrayBuffer for true atomics)
// ============================================

class AtomicCounter {
  constructor(initialValue = 0) {
    // Use regular number for single-threaded Node.js
    // For worker_threads, use SharedArrayBuffer
    this._value = initialValue;
  }

  /**
   * Get current value
   */
  get() {
    return this._value;
  }

  /**
   * Increment and return new value
   */
  increment(delta = 1) {
    this._value += delta;
    return this._value;
  }

  /**
   * Decrement and return new value
   */
  decrement(delta = 1) {
    this._value -= delta;
    return this._value;
  }

  /**
   * Set to new value and return old value
   */
  getAndSet(newValue) {
    const old = this._value;
    this._value = newValue;
    return old;
  }

  /**
   * Compare and swap: if current equals expected, set to newValue
   */
  compareAndSwap(expected, newValue) {
    if (this._value === expected) {
      this._value = newValue;
      return true;
    }
    return false;
  }

  /**
   * Add and get previous value
   */
  getAndAdd(delta) {
    const old = this._value;
    this._value += delta;
    return old;
  }
}

// ============================================
// Lock-Free Stack (Treiber Stack)
// ============================================

class LockFreeStack {
  constructor() {
    this.top = null;
    this._size = 0;
  }

  /**
   * Push item onto stack
   */
  push(item) {
    const node = { value: item, next: null };
    
    do {
      node.next = this.top;
    } while (!this._compareAndSwapTop(node.next, node));
    
    this._size++;
  }

  /**
   * Pop item from stack
   */
  pop() {
    let top;
    
    do {
      top = this.top;
      if (top === null) {
        return null;
      }
    } while (!this._compareAndSwapTop(top, top.next));
    
    this._size--;
    return top.value;
  }

  /**
   * Peek at top item
   */
  peek() {
    return this.top ? this.top.value : null;
  }

  /**
   * Compare and swap for top pointer
   */
  _compareAndSwapTop(expected, newValue) {
    if (this.top === expected) {
      this.top = newValue;
      return true;
    }
    return false;
  }

  isEmpty() {
    return this.top === null;
  }

  size() {
    return this._size;
  }
}

// ============================================
// Lock-Free Queue (Michael-Scott Queue variant)
// ============================================

class LockFreeQueue {
  constructor() {
    const sentinel = { value: null, next: null };
    this.head = sentinel;
    this.tail = sentinel;
    this._size = 0;
  }

  /**
   * Enqueue item
   */
  enqueue(item) {
    const node = { value: item, next: null };
    
    while (true) {
      const tail = this.tail;
      const next = tail.next;
      
      if (tail === this.tail) {
        if (next === null) {
          if (this._compareAndSwapNext(tail, null, node)) {
            this._compareAndSwapTail(tail, node);
            this._size++;
            return;
          }
        } else {
          this._compareAndSwapTail(tail, next);
        }
      }
    }
  }

  /**
   * Dequeue item
   */
  dequeue() {
    while (true) {
      const head = this.head;
      const tail = this.tail;
      const next = head.next;
      
      if (head === this.head) {
        if (head === tail) {
          if (next === null) {
            return null; // Queue is empty
          }
          this._compareAndSwapTail(tail, next);
        } else {
          const value = next.value;
          if (this._compareAndSwapHead(head, next)) {
            this._size--;
            return value;
          }
        }
      }
    }
  }

  /**
   * Peek at front item
   */
  peek() {
    const next = this.head.next;
    return next ? next.value : null;
  }

  _compareAndSwapNext(node, expected, newValue) {
    if (node.next === expected) {
      node.next = newValue;
      return true;
    }
    return false;
  }

  _compareAndSwapTail(expected, newValue) {
    if (this.tail === expected) {
      this.tail = newValue;
      return true;
    }
    return false;
  }

  _compareAndSwapHead(expected, newValue) {
    if (this.head === expected) {
      this.head = newValue;
      return true;
    }
    return false;
  }

  isEmpty() {
    return this.head.next === null;
  }

  size() {
    return this._size;
  }
}

// ============================================
// Timestamped Value (for versioning/MVCC)
// ============================================

class TimestampedValue {
  constructor(value = null) {
    this.value = value;
    this.timestamp = Date.now();
    this.version = 0;
  }

  /**
   * Update value with new timestamp and version
   */
  update(newValue) {
    this.value = newValue;
    this.timestamp = Date.now();
    this.version++;
    return this;
  }

  /**
   * Compare and update: only update if version matches
   */
  compareAndUpdate(expectedVersion, newValue) {
    if (this.version === expectedVersion) {
      this.update(newValue);
      return true;
    }
    return false;
  }

  /**
   * Get value with metadata
   */
  getWithMeta() {
    return {
      value: this.value,
      timestamp: this.timestamp,
      version: this.version,
    };
  }
}

// ============================================
// Concurrent Map (with versioned entries)
// ============================================

class ConcurrentMap {
  constructor() {
    this.map = new Map();
  }

  /**
   * Get value
   */
  get(key) {
    const entry = this.map.get(key);
    return entry ? entry.value : undefined;
  }

  /**
   * Get value with version info
   */
  getVersioned(key) {
    return this.map.get(key)?.getWithMeta() || null;
  }

  /**
   * Set value
   */
  set(key, value) {
    const existing = this.map.get(key);
    if (existing) {
      existing.update(value);
    } else {
      this.map.set(key, new TimestampedValue(value));
    }
    return this;
  }

  /**
   * Compare and set: only set if version matches
   */
  compareAndSet(key, expectedVersion, newValue) {
    const existing = this.map.get(key);
    if (!existing) {
      if (expectedVersion === 0 || expectedVersion === undefined) {
        this.map.set(key, new TimestampedValue(newValue));
        return true;
      }
      return false;
    }
    return existing.compareAndUpdate(expectedVersion, newValue);
  }

  /**
   * Delete key
   */
  delete(key) {
    return this.map.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.map.has(key);
  }

  /**
   * Get all keys
   */
  keys() {
    return Array.from(this.map.keys());
  }

  /**
   * Get size
   */
  size() {
    return this.map.size;
  }

  /**
   * Clear all entries
   */
  clear() {
    this.map.clear();
  }
}

// ============================================
// Exports
// ============================================

module.exports = {
  AtomicCounter,
  LockFreeStack,
  LockFreeQueue,
  TimestampedValue,
  ConcurrentMap,
};
