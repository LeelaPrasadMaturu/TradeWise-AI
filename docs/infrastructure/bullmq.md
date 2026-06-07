# BullMQ Setup Guide

BullMQ provides distributed job queues for asynchronous task processing in TradeWise AI.

## Table of Contents

- [Overview](#overview)
- [Local Development](#local-development)
- [Configuration](#configuration)
- [Queues](#queues)
- [Workers](#workers)
- [Job Patterns](#job-patterns)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         API SERVERS                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │ API 1   │  │ API 2   │  │ API N   │                         │
│  └────┬────┘  └────┬────┘  └────┬────┘                         │
└───────┼────────────┼────────────┼───────────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BULLMQ QUEUES (Redis)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ ai-analysis  │ │email-delivery│ │pattern-detect│            │
│  │    Queue     │ │    Queue     │ │    Queue     │            │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘            │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         WORKERS                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  AI Worker  │  │Email Worker │  │Pattern      │             │
│  │  (5 conc)   │  │  (3 conc)   │  │Worker(3)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Queue Definitions

| Queue | Purpose | Priority Jobs |
|-------|---------|---------------|
| `ai-analysis` | AI API calls (Gemini, FinBERT) | Post-trade analysis, emotion detection |
| `email-delivery` | Email sending | Briefings, alerts, reports |
| `pattern-detection` | Behavioral analysis | Pattern detection, baseline recalculation |
| `cache-warm` | Cache pre-warming | Active user cache |
| `scheduled-jobs` | Cron-like jobs | Daily briefings, weekly insights |

## Local Development

### Prerequisites

BullMQ requires Redis. Ensure Redis is running:

```bash
# Using Docker Compose
docker-compose up redis -d

# Verify Redis is ready
docker exec tradewise-redis redis-cli ping
```

### Running Workers

```bash
# Start worker process
cd backend
node workers/index.js

# Or with nodemon for development
npx nodemon workers/index.js
```

### Testing Job Processing

```javascript
// Add a test job manually
const { addAIAnalysisJob, JOB_TYPES } = require('./queues');

await addAIAnalysisJob(JOB_TYPES.EMOTION_DETECTION, {
  tradeId: 'test-trade-123',
  text: 'Feeling confident about this breakout trade',
});
```

## Configuration

### Environment Variables

```bash
# Redis connection for queues (separate from cache)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_QUEUE_DB=1          # Use different DB than cache
REDIS_PASSWORD=           # Optional
```

### Queue Options

```javascript
// backend/queues/index.js
const DEFAULT_JOB_OPTIONS = {
  'ai-analysis': {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
  'email-delivery': {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 5000 },
    removeOnFail: { age: 604800 },
  },
  // ...
};
```

## Queues

### AI Analysis Queue

Handles AI service calls with rate limiting:

```javascript
const { addAIAnalysisJob, JOB_TYPES } = require('./queues');

// Emotion detection
await addAIAnalysisJob(JOB_TYPES.EMOTION_DETECTION, {
  tradeId: trade._id,
  text: trade.reason,
  exitText: trade.exitReason,
});

// Post-trade analysis
await addAIAnalysisJob(JOB_TYPES.POST_TRADE_ANALYSIS, {
  tradeId: trade._id,
  userId: userId,
  tradeData: trade,
}, { priority: 1 });  // High priority

// Quiz generation
await addAIAnalysisJob(JOB_TYPES.QUIZ_GENERATION, {
  userId: userId,
  count: 5,
  difficulty: 'medium',
});
```

### Email Delivery Queue

```javascript
const { addEmailJob, JOB_TYPES } = require('./queues');

// Pre-market briefing
await addEmailJob(JOB_TYPES.PRE_MARKET_BRIEFING, {
  userId: user._id,
  email: user.email,
  name: user.name,
});

// Price alert
await addEmailJob(JOB_TYPES.PRICE_ALERT, {
  email: user.email,
  symbol: 'RELIANCE',
  triggerType: 'price_above',
  triggerValue: 2500,
  currentPrice: 2510,
});
```

### Pattern Detection Queue

```javascript
const { addPatternDetectionJob, JOB_TYPES } = require('./queues');

// Behavioral analysis
await addPatternDetectionJob(JOB_TYPES.BEHAVIORAL_ANALYSIS, {
  userId: userId,
  tradeId: trade._id,
  trigger: 'trade_created',
});

// Baseline recalculation
await addPatternDetectionJob(JOB_TYPES.BASELINE_RECALCULATION, {
  userId: userId,
  force: false,
}, { delay: 5000 });  // Delay 5s to ensure trade is saved
```

### Job Flows

Create dependent jobs that execute in sequence:

```javascript
const { createTradeProcessingFlow } = require('./queues');

// Creates: Emotion Detection → Post-Trade Analysis
//                           → Behavioral Analysis
await createTradeProcessingFlow(trade._id, userId, tradeData);
```

## Workers

### Starting Workers

Workers are started via the `workers/index.js` entry point:

```javascript
// workers/index.js
const { startWorker: startAIWorker } = require('../queues/workers/aiWorker');
const { startWorker: startEmailWorker } = require('../queues/workers/emailWorker');
const { startWorker: startPatternWorker } = require('../queues/workers/patternWorker');

// Start with configured concurrency
startAIWorker({ concurrency: 5 });
startEmailWorker({ concurrency: 3 });
startPatternWorker({ concurrency: 3 });
```

### Worker Configuration

```javascript
// AI Worker with rate limiting
startAIWorker({
  concurrency: 5,           // Max 5 concurrent jobs
  limiter: {
    max: 10,               // Max 10 jobs per duration
    duration: 1000,        // 1 second (rate limits AI APIs)
  },
});
```

### Custom Worker

```javascript
// Create a new worker
const { Worker } = require('bullmq');

function startMyWorker(options = {}) {
  const worker = new Worker(
    'my-queue',
    async (job) => {
      const { name, data } = job;
      await job.updateProgress(10);
      
      // Process job
      const result = await processJob(data);
      
      await job.updateProgress(100);
      return result;
    },
    {
      connection: createConnection(),
      concurrency: options.concurrency || 5,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed:`, error.message);
  });

  return worker;
}
```

## Job Patterns

### Priority Jobs

```javascript
// Priority: 1 (highest) to 10 (lowest)
await addAIAnalysisJob(JOB_TYPES.POST_TRADE_ANALYSIS, data, {
  priority: 1,  // Process before other jobs
});
```

### Delayed Jobs

```javascript
await addPatternDetectionJob(JOB_TYPES.BASELINE_RECALCULATION, data, {
  delay: 5000,  // Wait 5 seconds before processing
});
```

### Scheduled/Repeatable Jobs

```javascript
// Set up in queue initialization
await scheduledQueue.add(
  JOB_TYPES.DAILY_BRIEFING_BATCH,
  {},
  {
    repeat: {
      pattern: '0 3 * * 1-5',  // 3:00 AM UTC, Mon-Fri
      tz: 'UTC',
    },
    jobId: 'daily-briefing-batch',  // Ensures only one job
  }
);
```

### Retry with Backoff

```javascript
// Exponential backoff: 2s, 4s, 8s, 16s...
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
}

// Fixed delay
{
  attempts: 3,
  backoff: {
    type: 'fixed',
    delay: 5000,
  },
}
```

### Job Progress

```javascript
async function processJob(job) {
  await job.updateProgress(10);  // 10%
  
  const step1 = await doStep1();
  await job.updateProgress(40);  // 40%
  
  const step2 = await doStep2();
  await job.updateProgress(80);  // 80%
  
  await job.updateProgress(100); // Complete
  return { step1, step2 };
}
```

## Monitoring

### Queue Statistics

```javascript
const { getQueueStats, getAllQueueStats } = require('./queues');

// Single queue
const stats = await getQueueStats('ai-analysis');
// { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 1 }

// All queues
const allStats = await getAllQueueStats();
```

### Bull Board (UI)

Add to your development setup:

```javascript
// server.js (development only)
if (process.env.NODE_ENV !== 'production') {
  const { createBullBoard } = require('@bull-board/api');
  const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
  const { ExpressAdapter } = require('@bull-board/express');
  
  const serverAdapter = new ExpressAdapter();
  
  createBullBoard({
    queues: [
      new BullMQAdapter(queues['ai-analysis']),
      new BullMQAdapter(queues['email-delivery']),
      new BullMQAdapter(queues['pattern-detection']),
    ],
    serverAdapter,
  });
  
  serverAdapter.setBasePath('/admin/queues');
  app.use('/admin/queues', serverAdapter.getRouter());
}
```

### Prometheus Metrics

```javascript
// backend/utils/metrics.js exposes queue metrics
tradewise_queue_depth{queue="ai-analysis", state="waiting"} 5
tradewise_queue_depth{queue="ai-analysis", state="active"} 2
tradewise_queue_jobs_total{queue="ai-analysis", status="completed"} 1000
tradewise_queue_jobs_total{queue="ai-analysis", status="failed"} 10
```

## Troubleshooting

### Jobs Stuck in Active

```bash
# Check Redis for stuck jobs
redis-cli KEYS "bull:ai-analysis:active*"

# Force clean stalled jobs (in code)
await queue.clean(0, 1000, 'active');
```

### Jobs Not Processing

1. **Check worker is running**:
   ```bash
   ps aux | grep "workers/index.js"
   ```

2. **Check Redis connection**:
   ```bash
   redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
   ```

3. **Check queue depth**:
   ```javascript
   const stats = await getQueueStats('ai-analysis');
   console.log('Waiting:', stats.waiting);
   console.log('Active:', stats.active);
   ```

### High Memory Usage

```javascript
// Ensure old jobs are cleaned
{
  removeOnComplete: {
    age: 3600,    // Remove after 1 hour
    count: 1000,  // Keep max 1000 completed
  },
  removeOnFail: {
    age: 86400,   // Keep failed for 24h for debugging
  },
}
```

### Worker Crashes

```javascript
// Proper shutdown handling
process.on('SIGTERM', async () => {
  await worker.close();  // Finishes current jobs
  process.exit(0);
});
```

### Dead Letter Queue

For jobs that fail all retries:

```javascript
worker.on('failed', async (job, error) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Move to DLQ
    await deadLetterQueue.add('failed-job', {
      originalQueue: 'ai-analysis',
      jobId: job.id,
      data: job.data,
      error: error.message,
      failedAt: new Date(),
    });
  }
});
```

## Production Considerations

### Scaling Workers

```yaml
# k8s/base/worker-deployment.yaml
spec:
  replicas: 4  # Scale based on queue depth
```

### Concurrency Tuning

| Queue | Recommended Concurrency | Reason |
|-------|------------------------|--------|
| `ai-analysis` | 5-10 | Rate limited by AI APIs |
| `email-delivery` | 3-5 | SMTP connection limits |
| `pattern-detection` | 3-5 | CPU/DB intensive |
| `cache-warm` | 10+ | Fast Redis operations |

### HPA for Workers

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef:
    kind: Deployment
    name: worker
  metrics:
    - type: External
      external:
        metric:
          name: bullmq_queue_depth
        target:
          type: AverageValue
          averageValue: "50"  # Scale when queue > 50
```
