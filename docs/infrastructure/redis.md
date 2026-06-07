# Redis Setup Guide

Redis is used for distributed caching, rate limiting, and distributed locks in TradeWise AI.

## Table of Contents

- [Overview](#overview)
- [Local Development](#local-development)
- [Configuration](#configuration)
- [Features](#features)
- [API Reference](#api-reference)
- [Rate Limiting](#rate-limiting)
- [Production Setup](#production-setup)
- [Troubleshooting](#troubleshooting)

## Overview

### Use Cases

| Feature | Purpose | Implementation |
|---------|---------|----------------|
| **Caching** | AI response caching, user data | Cache-aside pattern |
| **Rate Limiting** | API protection | Token bucket + sliding window |
| **Distributed Locks** | Cron job coordination | Redlock algorithm |
| **Session Storage** | JWT blacklisting | Key-value with TTL |
| **Pub/Sub** | Cache invalidation | Cross-instance messaging |

## Local Development

### Using Docker Compose

```bash
# Start Redis with Docker Compose
docker-compose up redis -d

# Verify connection
docker exec tradewise-redis redis-cli ping
# Output: PONG
```

### Manual Installation

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis
```

### Connect to Redis CLI

```bash
# Local
redis-cli

# Docker
docker exec -it tradewise-redis redis-cli

# With password
redis-cli -a your_password
```

## Configuration

### Environment Variables

```bash
# Basic configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=            # Optional, leave empty for no auth
REDIS_DB=0                 # Database index for caching
REDIS_QUEUE_DB=1           # Separate database for BullMQ queues
REDIS_KEY_PREFIX=tradewise:

# TLS (for production)
REDIS_TLS=false

# Cluster mode (for production)
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### Connection Options

The Redis service automatically configures:

- **Reconnection**: Exponential backoff (100ms - 3s)
- **Max retries**: 10 attempts before failing
- **Command timeout**: 5 seconds
- **Connection timeout**: 10 seconds

## Features

### 1. Cache-Aside Pattern

```javascript
const redisService = require('./services/redisService');

// Basic get/set
await redisService.set('user:123', userData, 900); // 15 min TTL
const user = await redisService.get('user:123');

// Cache-aside with automatic fetch
const { data, fromCache } = await redisService.getOrSet(
  'expensive:calculation',
  async () => {
    return await expensiveOperation();
  },
  300 // 5 min TTL
);
```

### 2. Stale-While-Revalidate

```javascript
// Returns stale data immediately while refreshing in background
const { data, fromCache, stale } = await redisService.getOrSetSWR(
  'ai:insights:user123',
  async () => generateInsights(userId),
  900,  // 15 min TTL
  60    // 1 min stale TTL
);
```

### 3. Distributed Locks (Redlock)

```javascript
// Acquire lock for exclusive operations
const lock = await redisService.acquireLock('cron:daily-briefing', 60000);

if (lock) {
  try {
    // Only one instance runs this
    await sendDailyBriefings();
  } finally {
    await lock.release();
  }
} else {
  console.log('Another instance is handling this');
}
```

### 4. Cache Invalidation

```javascript
// Invalidate single key
await redisService.del('user:123');

// Invalidate by pattern (with pub/sub notification)
await redisService.invalidate('user:123:*');

// All instances receive invalidation message via pub/sub
```

## Rate Limiting

### Token Bucket Algorithm

Best for APIs that need to allow bursts:

```javascript
const { createTokenBucketLimiter } = require('./middlewares/redisRateLimit');

const limiter = createTokenBucketLimiter({
  capacity: 60,      // Max 60 tokens (burst capacity)
  refillRate: 1,     // Refill 1 token per second
  keyPrefix: 'ratelimit:api',
});

app.use('/api', limiter);
```

### Sliding Window Algorithm

Best for precise rate limiting:

```javascript
const { createSlidingWindowLimiter } = require('./middlewares/redisRateLimit');

const limiter = createSlidingWindowLimiter({
  window: 60000,     // 1 minute window
  max: 100,          // Max 100 requests per window
  keyPrefix: 'ratelimit:precise',
});
```

### Combined Limiter (IP + User)

```javascript
const { createCombinedLimiter } = require('./middlewares/redisRateLimit');

const limiter = createCombinedLimiter({
  ipLimit: 300,      // 300 req/min per IP
  ipWindow: 60000,
  userLimit: 600,    // 600 req/min per authenticated user
  userWindow: 60000,
  endpoints: {
    '/api/trades': { ipLimit: 60, userLimit: 120 },  // Stricter for writes
  },
});
```

### Response Headers

All rate-limited responses include:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
Retry-After: 30  # Only on 429 responses
```

## Production Setup

### Redis Cluster (Recommended)

For high availability and horizontal scaling:

```bash
# Set cluster nodes in environment
REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379,redis-4:6379,redis-5:6379,redis-6:6379
```

Minimum cluster requirements:
- 3 master nodes
- 3 replica nodes (1 per master)

### Redis Sentinel (Alternative)

For automatic failover without sharding:

```bash
# Configure sentinel in your Redis setup
# Application connects to sentinel, which provides master info
```

### Kubernetes Deployment

Using Bitnami Helm chart:

```bash
helm install redis bitnami/redis \
  --set architecture=replication \
  --set replica.replicaCount=2 \
  --set auth.enabled=true \
  --set auth.password=$REDIS_PASSWORD \
  --namespace tradewise
```

### Memory Management

```bash
# redis.conf or Docker command
maxmemory 256mb
maxmemory-policy allkeys-lru
```

| Policy | Use Case |
|--------|----------|
| `allkeys-lru` | General caching (recommended) |
| `volatile-lru` | Only evict keys with TTL |
| `allkeys-lfu` | Frequently accessed data |
| `noeviction` | Never evict (will error when full) |

## Troubleshooting

### Connection Issues

```bash
# Test connectivity
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping

# Check if password required
redis-cli -h $REDIS_HOST -p $REDIS_PORT auth $REDIS_PASSWORD

# Monitor real-time commands
redis-cli monitor
```

### Memory Issues

```bash
# Check memory usage
redis-cli info memory

# Get key count and memory by prefix
redis-cli --scan --pattern "tradewise:*" | wc -l

# Find large keys
redis-cli --bigkeys
```

### Slow Queries

```bash
# Enable slow log
redis-cli config set slowlog-log-slower-than 10000  # 10ms
redis-cli slowlog get 10
```

### Graceful Degradation

The Redis service automatically falls back to in-memory caching when Redis is unavailable:

```javascript
// This works even without Redis connection
const data = await redisService.get('key');  // Returns from local cache
await redisService.set('key', value);        // Stores in local cache
```

## Monitoring

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `used_memory` | Current memory usage | > 80% of maxmemory |
| `connected_clients` | Active connections | > 1000 |
| `evicted_keys` | Keys evicted due to memory | > 100/min |
| `keyspace_hits/misses` | Cache hit ratio | < 80% hit rate |

### Prometheus Metrics

The Redis exporter provides metrics at `/metrics`:

```yaml
# docker-compose.yml
redis-exporter:
  image: oliver006/redis_exporter:latest
  environment:
    - REDIS_ADDR=redis://redis:6379
```

### Grafana Dashboard

Import dashboard ID `763` for Redis monitoring.

## Code Examples

### Service Integration

```javascript
// backend/services/insightsService.js
const redisService = require('./redisService');

async function getWeeklyInsights(userId, startDate, endDate) {
  const cacheKey = redisService.generateKey('insights:weekly', userId, startDate, endDate);
  
  const { data, fromCache } = await redisService.getOrSet(
    cacheKey,
    async () => {
      // Expensive AI call
      return await generateInsightsWithAI(userId, startDate, endDate);
    },
    900 // 15 min cache
  );
  
  return { ...data, cached: fromCache };
}
```

### Cache Invalidation on Update

```javascript
// When user updates profile
async function updateUserProfile(userId, data) {
  await User.findByIdAndUpdate(userId, data);
  
  // Invalidate all user-related caches
  await redisService.invalidate(`user:${userId}:*`);
  await redisService.invalidate(`insights:*:${userId}:*`);
}
```
