# Infrastructure Overview

TradeWise AI uses enterprise-grade distributed systems infrastructure to ensure scalability, reliability, and performance.

## Components

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **Redis Cluster** | Distributed caching, rate limiting, distributed locks | [redis.md](./redis.md) |
| **Apache Kafka** | Event streaming, async communication | [kafka.md](./kafka.md) |
| **BullMQ** | Job queues for background processing | [bullmq.md](./bullmq.md) |

## Architecture Patterns

### 1. Cache-Aside Pattern (Redis)

```
┌─────────┐     1. Check Cache     ┌─────────┐
│  API    │──────────────────────▶│  Redis  │
│ Server  │◀──────────────────────│ Cluster │
└────┬────┘     2. Cache Hit       └─────────┘
     │              │
     │ 3. Cache Miss│
     ▼              │
┌─────────┐         │
│ MongoDB │         │
└────┬────┘         │
     │              │
     │ 4. Fetch     │
     ▼              │
┌─────────┐         │
│  API    │─────────┘
│ Server  │  5. Update Cache
└─────────┘
```

### 2. Event-Driven Architecture (Kafka)

```
┌─────────┐                    ┌─────────┐
│  API    │─── trade.created ─▶│  Kafka  │
│ Server  │                    │ Broker  │
└─────────┘                    └────┬────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │ Analysis │   │  Alert   │   │ Pattern  │
              │ Consumer │   │ Consumer │   │ Consumer │
              └──────────┘   └──────────┘   └──────────┘
```

### 3. Circuit Breaker Pattern

```
┌─────────┐      ┌─────────────┐      ┌──────────┐
│  API    │─────▶│   Circuit   │─────▶│ External │
│ Server  │      │   Breaker   │      │    AI    │
└─────────┘      └──────┬──────┘      └──────────┘
                        │
                        │ When OPEN
                        ▼
                 ┌──────────────┐
                 │   Fallback   │
                 │   Response   │
                 └──────────────┘
```

### 4. Bulkhead Pattern

```
┌───────────────────────────────────────────────┐
│                 API Server                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│  │  Gemini   │ │  FinBERT  │ │  Cohere   │   │
│  │ Bulkhead  │ │ Bulkhead  │ │ Bulkhead  │   │
│  │  (max 5)  │ │ (max 10)  │ │  (max 5)  │   │
│  └───────────┘ └───────────┘ └───────────┘   │
└───────────────────────────────────────────────┘
```

## Connection Requirements

### Redis
- **Host**: `REDIS_HOST` (default: localhost)
- **Port**: `REDIS_PORT` (default: 6379)
- **Password**: `REDIS_PASSWORD` (optional)
- **Queue DB**: `REDIS_QUEUE_DB` (default: 1, separate from cache)

### Kafka
- **Brokers**: `KAFKA_BROKERS` (default: localhost:9092)
- **Client ID**: `KAFKA_CLIENT_ID` (default: tradewise-api)
- **SSL**: `KAFKA_SSL` (default: false)

### MongoDB
- **URI**: `MONGODB_URI` (required)
- **Pool Size**: 10 connections (configured in db.js)

## Health Checks

All infrastructure components expose health check endpoints:

| Component | Endpoint | Method |
|-----------|----------|--------|
| API | `/health` | GET |
| Redis | Internal ping | - |
| Kafka | Admin describe cluster | - |
| Circuit Breakers | `/health/circuits` | GET |
| Queues | `/health/queues` | GET |

## Initialization Order

1. **MongoDB** - Primary database connection
2. **Redis** - Cache and rate limiting
3. **Kafka** - Event streaming (optional, graceful degradation)
4. **BullMQ Queues** - Job queue initialization
5. **Circuit Breakers** - Fault tolerance setup
6. **Prometheus Metrics** - Observability

## Graceful Shutdown

The system implements graceful shutdown in this order:

1. Stop accepting new HTTP requests
2. Wait for in-flight requests to complete
3. Stop BullMQ workers (finish current jobs)
4. Close Kafka consumers
5. Disconnect from Redis
6. Close MongoDB connection

```javascript
// Handled automatically in server.js and workers/index.js
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Monitoring

See [observability.md](../development/observability.md) for detailed monitoring setup.

Key metrics exposed:
- `tradewise_http_requests_total` - Request counts
- `tradewise_http_request_duration_seconds` - Latency percentiles
- `tradewise_circuit_breaker_state` - Circuit breaker states
- `tradewise_queue_depth` - Queue sizes
- `tradewise_ai_api_duration_seconds` - AI service latencies
