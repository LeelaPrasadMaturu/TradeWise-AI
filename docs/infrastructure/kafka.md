# Apache Kafka Setup Guide

Apache Kafka provides event streaming for TradeWise AI's event-driven architecture.

## Table of Contents

- [Overview](#overview)
- [Local Development](#local-development)
- [Configuration](#configuration)
- [Topics](#topics)
- [Producing Events](#producing-events)
- [Consuming Events](#consuming-events)
- [Production Setup](#production-setup)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

### Event Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         PRODUCERS                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ Trade API  │  │ Alert API  │  │ Rule API   │                 │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                 │
└────────┼───────────────┼───────────────┼────────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                       KAFKA TOPICS                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │trade.created │ │alert.trigger │ │rule.violated │             │
│  │trade.closed  │ │              │ │              │             │
│  │trade.updated │ │              │ │              │             │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        CONSUMERS                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ AI Worker  │  │Email Worker│  │Pattern     │                 │
│  │            │  │            │  │Detector    │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

### Use Cases

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `trade.created` | New trade logged | AI analysis, Pattern detection |
| `trade.closed` | Trade exit | Post-trade analysis, Stats update |
| `pattern.detected` | Behavioral pattern found | Alerting, Dashboard |
| `alert.triggered` | Price alert hit | Email, Push notification |
| `rule.violated` | Trading rule breach | Coaching, Analytics |

## Local Development

### Using Docker Compose

```bash
# Start Kafka with Zookeeper
docker-compose up zookeeper kafka -d

# Wait for Kafka to be ready (~30 seconds)
docker-compose logs -f kafka | grep -m 1 "started"

# Create topics
docker exec tradewise-kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic tradewise.trades.created \
  --partitions 6 \
  --replication-factor 1
```

### Verify Installation

```bash
# List topics
docker exec tradewise-kafka kafka-topics --list \
  --bootstrap-server localhost:9092

# Produce test message
echo '{"test": "message"}' | docker exec -i tradewise-kafka \
  kafka-console-producer --bootstrap-server localhost:9092 \
  --topic test

# Consume test message
docker exec tradewise-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic test \
  --from-beginning \
  --max-messages 1
```

## Configuration

### Environment Variables

```bash
# Basic configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=tradewise-api

# Security (for production)
KAFKA_SSL=false
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=
KAFKA_SASL_MECHANISM=plain

# Consumer settings
KAFKA_GROUP_ID=tradewise-workers
```

### Client Configuration

```javascript
// backend/events/kafkaClient.js exports these options
const kafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID || 'tradewise-api',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
  },
};
```

## Topics

### Topic Definitions

```javascript
// backend/events/topics.js
const TOPICS = {
  // Trade lifecycle
  TRADE_CREATED: 'tradewise.trades.created',
  TRADE_UPDATED: 'tradewise.trades.updated',
  TRADE_CLOSED: 'tradewise.trades.closed',
  
  // Analysis
  ANALYSIS_COMPLETED: 'tradewise.analysis.completed',
  EMOTION_DETECTED: 'tradewise.analysis.emotion-detected',
  
  // Patterns
  PATTERN_DETECTED: 'tradewise.patterns.detected',
  
  // Alerts
  PRICE_ALERT_TRIGGERED: 'tradewise.alerts.price-triggered',
  RULE_VIOLATED: 'tradewise.alerts.rule-violated',
  
  // System
  ERROR_OCCURRED: 'tradewise.system.errors',
};
```

### Topic Configuration

| Topic | Partitions | Retention | Purpose |
|-------|------------|-----------|---------|
| `trades.created` | 6 | 7 days | High-traffic trade events |
| `trades.closed` | 6 | 30 days | Trade completion for analytics |
| `analysis.completed` | 3 | 3 days | AI analysis results |
| `patterns.detected` | 3 | 14 days | Behavioral patterns |
| `alerts.*` | 3 | 1-7 days | Alert notifications |
| `system.errors` | 3 | 30 days | Error tracking |

### Creating Topics Manually

```bash
# Create topic with specific config
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic tradewise.trades.created \
  --partitions 6 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config cleanup.policy=delete
```

## Producing Events

### Basic Usage

```javascript
const { publishEvent } = require('./events/kafkaClient');
const { TOPICS, createTradeEvent, EVENT_TYPES } = require('./events/topics');

// Publish trade created event
await publishEvent(
  TOPICS.TRADE_CREATED,
  createTradeEvent(EVENT_TYPES.TRADE_CREATED, trade, userId),
  { key: trade._id.toString() }  // Ensures ordering per trade
);
```

### Event Structure

```javascript
// All events follow this structure
{
  type: 'trade.created',
  data: {
    tradeId: '...',
    userId: '...',
    symbol: 'RELIANCE',
    direction: 'long',
    entryPrice: 2450.50,
    // ... trade-specific data
  },
  metadata: {
    version: '1.0',
    correlationId: 'abc-123-def',
    causationId: 'previous-event-id',
    userId: '...',
    timestamp: 1640000000000,
    source: 'api',
  }
}
```

### Batch Publishing

```javascript
const { publishBatch } = require('./events/kafkaClient');

// Publish multiple events efficiently
await publishBatch([
  { topic: TOPICS.TRADE_CREATED, event: event1, key: 'trade-1' },
  { topic: TOPICS.TRADE_CREATED, event: event2, key: 'trade-2' },
  { topic: TOPICS.TRADE_CREATED, event: event3, key: 'trade-3' },
]);
```

## Consuming Events

### Creating a Consumer

```javascript
const { createConsumer } = require('./events/kafkaClient');
const { TOPICS, CONSUMER_GROUPS } = require('./events/topics');

const consumer = await createConsumer(
  CONSUMER_GROUPS.AI_ANALYSIS,  // Group ID
  [TOPICS.TRADE_CREATED, TOPICS.TRADE_CLOSED],  // Topics
  async (message) => {
    const { topic, event, key, offset } = message;
    
    console.log(`Processing ${event.type} from ${topic}`);
    
    // Your processing logic here
    await processEvent(event);
  },
  {
    fromBeginning: false,
    autoCommit: true,
  }
);
```

### Consumer Groups

| Group ID | Topics | Purpose |
|----------|--------|---------|
| `tradewise-ai-analysis` | trades.* | AI processing |
| `tradewise-pattern-detection` | trades.*, patterns.* | Pattern detection |
| `tradewise-alert-handler` | alerts.* | Alert notifications |
| `tradewise-email-notifications` | * (filtered) | Email delivery |

### Error Handling

```javascript
// Handler with error handling and dead letter queue
async function handleTradeCreated(message) {
  try {
    await processEvent(message.event);
  } catch (error) {
    // Log error
    console.error('Processing failed:', error);
    
    // Optionally publish to error topic
    await publishEvent(TOPICS.ERROR_OCCURRED, {
      type: 'consumer.error',
      data: {
        originalTopic: message.topic,
        originalEvent: message.event,
        error: error.message,
      },
    });
    
    // Don't throw - allows auto-commit to proceed
    // For retry, configure consumer with retry logic
  }
}
```

## Production Setup

### Kubernetes Deployment

Using Bitnami Helm chart:

```bash
helm install kafka bitnami/kafka \
  --set replicaCount=3 \
  --set zookeeper.enabled=true \
  --set zookeeper.replicaCount=3 \
  --set persistence.enabled=true \
  --set persistence.size=50Gi \
  --namespace tradewise
```

### Cluster Sizing

| Cluster Size | Use Case | Configuration |
|--------------|----------|---------------|
| **Small** | Development | 1 broker, 1 ZK |
| **Medium** | Production (< 100K msg/day) | 3 brokers, 3 ZK |
| **Large** | Production (> 1M msg/day) | 6+ brokers, 3 ZK |

### Replication

```bash
# Set replication factor for high availability
kafka-topics --alter \
  --bootstrap-server kafka:9092 \
  --topic tradewise.trades.created \
  --partitions 6 \
  --replication-factor 3
```

### Consumer Scaling

```yaml
# k8s/base/worker-deployment.yaml
spec:
  replicas: 3  # Match partition count for parallel processing
```

Each consumer in a group gets assigned different partitions, enabling parallel processing.

## Monitoring

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `kafka_consumer_lag` | Messages behind | > 1000 |
| `kafka_messages_in_per_sec` | Ingestion rate | - |
| `kafka_bytes_in_per_sec` | Network in | > 80% capacity |
| `kafka_under_replicated_partitions` | Unhealthy partitions | > 0 |

### Kafka Manager UI

```bash
# Add to docker-compose.yml for development
kafka-ui:
  image: provectuslabs/kafka-ui:latest
  ports:
    - "8080:8080"
  environment:
    - KAFKA_CLUSTERS_0_NAME=local
    - KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092
```

### Consumer Lag Monitoring

```bash
# Check consumer lag
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --describe --group tradewise-ai-analysis
```

## Troubleshooting

### Connection Issues

```bash
# Test broker connectivity
kafka-broker-api-versions --bootstrap-server localhost:9092

# Check cluster health
kafka-metadata --bootstrap-server localhost:9092 --describe
```

### Consumer Not Receiving Messages

1. **Check consumer group status**:
   ```bash
   kafka-consumer-groups --bootstrap-server localhost:9092 \
     --describe --group your-group-id
   ```

2. **Verify topic exists**:
   ```bash
   kafka-topics --list --bootstrap-server localhost:9092
   ```

3. **Check from beginning**:
   ```bash
   kafka-console-consumer --bootstrap-server localhost:9092 \
     --topic your-topic --from-beginning --max-messages 5
   ```

### Message Not Delivered

```javascript
// Enable debug logging
const kafka = new Kafka({
  // ...config
  logLevel: logLevel.DEBUG,
});
```

### Rebalancing Issues

If consumers keep rebalancing:

1. Increase `sessionTimeout` (default 30s)
2. Increase `heartbeatInterval` (default 3s)
3. Reduce `maxPollRecords` if processing is slow

```javascript
const consumer = kafka.consumer({
  groupId: 'your-group',
  sessionTimeout: 60000,
  heartbeatInterval: 10000,
  maxBytesPerPartition: 1048576,
});
```

### Graceful Degradation

Kafka is optional - the system continues operating without it:

```javascript
// kafkaClient.js handles missing Kafka
try {
  await initializeKafka();
} catch (error) {
  console.warn('Kafka unavailable, continuing without events');
  // System continues with reduced functionality
}
```

## Code Examples

### Trade Event Flow

```javascript
// In trade route handler
async function createTrade(req, res) {
  // 1. Create trade in MongoDB
  const trade = await Trade.create(tradeData);
  
  // 2. Publish event to Kafka
  await publishEvent(
    TOPICS.TRADE_CREATED,
    createTradeEvent(EVENT_TYPES.TRADE_CREATED, trade, req.user._id)
  );
  
  res.status(201).json(trade);
}

// In worker - handles the event
async function handleTradeCreated(message) {
  const { data } = message.event;
  
  // Queue AI analysis job
  await addAIAnalysisJob(JOB_TYPES.EMOTION_DETECTION, {
    tradeId: data.tradeId,
    text: data.reason,
  });
  
  // Check for patterns
  await addPatternDetectionJob(JOB_TYPES.BEHAVIORAL_ANALYSIS, {
    userId: data.userId,
    tradeId: data.tradeId,
  });
}
```
