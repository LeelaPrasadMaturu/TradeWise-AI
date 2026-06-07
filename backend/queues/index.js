/**
 * BullMQ Queue Configuration
 * 
 * Distributed job queue system for async processing:
 * - AI analysis jobs (post-trade, quiz generation, insights)
 * - Email delivery (briefings, alerts, reports)
 * - Pattern detection (behavioral analysis)
 * - Cache warming (pre-warm cache for active users)
 */

const { Queue, QueueEvents, FlowProducer } = require('bullmq');
const Redis = require('ioredis');

// Redis connection for BullMQ (separate from caching to avoid conflicts)
const createConnection = () => {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_QUEUE_DB, 10) || 1, // Use different DB for queues
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
};

// Queue names
const QUEUE_NAMES = {
  AI_ANALYSIS: 'ai-analysis',
  EMAIL_DELIVERY: 'email-delivery',
  PATTERN_DETECTION: 'pattern-detection',
  CACHE_WARM: 'cache-warm',
  SCHEDULED_JOBS: 'scheduled-jobs',
};

// Job types for each queue
const JOB_TYPES = {
  // AI Analysis
  POST_TRADE_ANALYSIS: 'post-trade-analysis',
  QUIZ_GENERATION: 'quiz-generation',
  FLASHCARD_GENERATION: 'flashcard-generation',
  WEEKLY_INSIGHTS: 'weekly-insights',
  EMOTION_DETECTION: 'emotion-detection',
  COACH_ADVICE: 'coach-advice',

  // Email
  PRE_MARKET_BRIEFING: 'pre-market-briefing',
  WEEKLY_REPORT: 'weekly-report',
  PRICE_ALERT: 'price-alert',
  RULE_VIOLATION_ALERT: 'rule-violation-alert',

  // Pattern Detection
  BEHAVIORAL_ANALYSIS: 'behavioral-analysis',
  BASELINE_RECALCULATION: 'baseline-recalculation',
  DISCIPLINE_SCORE: 'discipline-score',

  // Cache
  WARM_USER_CACHE: 'warm-user-cache',
  INVALIDATE_CACHE: 'invalidate-cache',

  // Scheduled
  DAILY_BRIEFING_BATCH: 'daily-briefing-batch',
  WEEKLY_INSIGHTS_BATCH: 'weekly-insights-batch',
};

// Default job options by queue
const DEFAULT_JOB_OPTIONS = {
  [QUEUE_NAMES.AI_ANALYSIS]: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // 24 hours
    },
  },
  [QUEUE_NAMES.EMAIL_DELIVERY]: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400,
      count: 5000,
    },
    removeOnFail: {
      age: 604800, // 7 days
    },
  },
  [QUEUE_NAMES.PATTERN_DETECTION]: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600,
      count: 500,
    },
    removeOnFail: {
      age: 86400,
    },
  },
  [QUEUE_NAMES.CACHE_WARM]: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true,
  },
  [QUEUE_NAMES.SCHEDULED_JOBS]: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: {
      age: 86400,
      count: 100,
    },
    removeOnFail: {
      age: 604800,
    },
  },
};

// Queue instances
let queues = {};
let queueEvents = {};
let flowProducer = null;
let connection = null;
let isInitialized = false;

/**
 * Initialize all queues
 */
async function initializeQueues() {
  if (isInitialized) {
    return { queues, queueEvents, flowProducer };
  }

  connection = createConnection();

  // Create queues
  for (const [key, name] of Object.entries(QUEUE_NAMES)) {
    queues[name] = new Queue(name, {
      connection: createConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS[name],
    });

    // Create queue events for monitoring
    queueEvents[name] = new QueueEvents(name, {
      connection: createConnection(),
    });

    // Setup event listeners
    setupQueueEventListeners(name, queueEvents[name]);
  }

  // Flow producer for job dependencies
  flowProducer = new FlowProducer({
    connection: createConnection(),
  });

  // Setup repeatable jobs (cron-like)
  await setupRepeatableJobs();

  isInitialized = true;
  console.log('[Queues] All queues initialized');

  return { queues, queueEvents, flowProducer };
}

/**
 * Setup event listeners for queue monitoring
 */
function setupQueueEventListeners(queueName, events) {
  events.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[Queue:${queueName}] Job ${jobId} completed`);
  });

  events.on('failed', ({ jobId, failedReason }) => {
    console.error(`[Queue:${queueName}] Job ${jobId} failed:`, failedReason);
  });

  events.on('stalled', ({ jobId }) => {
    console.warn(`[Queue:${queueName}] Job ${jobId} stalled`);
  });

  events.on('progress', ({ jobId, data }) => {
    console.log(`[Queue:${queueName}] Job ${jobId} progress:`, data);
  });
}

/**
 * Setup repeatable/scheduled jobs
 */
async function setupRepeatableJobs() {
  const scheduledQueue = queues[QUEUE_NAMES.SCHEDULED_JOBS];

  // Pre-market briefing at 8:30 AM IST (3:00 AM UTC) on weekdays
  await scheduledQueue.add(
    JOB_TYPES.DAILY_BRIEFING_BATCH,
    {},
    {
      repeat: {
        pattern: '0 3 * * 1-5', // Mon-Fri at 3:00 AM UTC
        tz: 'UTC',
      },
      jobId: 'daily-briefing-batch',
    }
  );

  // Weekly insights on Sunday at 8:00 AM IST (2:30 AM UTC)
  await scheduledQueue.add(
    JOB_TYPES.WEEKLY_INSIGHTS_BATCH,
    {},
    {
      repeat: {
        pattern: '30 2 * * 0', // Sunday at 2:30 AM UTC
        tz: 'UTC',
      },
      jobId: 'weekly-insights-batch',
    }
  );

  console.log('[Queues] Repeatable jobs configured');
}

/**
 * Add job to AI Analysis queue
 */
async function addAIAnalysisJob(type, data, options = {}) {
  const queue = queues[QUEUE_NAMES.AI_ANALYSIS];
  if (!queue) throw new Error('AI Analysis queue not initialized');

  const jobOptions = {
    ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.AI_ANALYSIS],
    ...options,
  };

  // Add priority based on job type
  if (type === JOB_TYPES.POST_TRADE_ANALYSIS) {
    jobOptions.priority = 1; // Highest priority
  } else if (type === JOB_TYPES.EMOTION_DETECTION) {
    jobOptions.priority = 2;
  } else {
    jobOptions.priority = 5;
  }

  return queue.add(type, data, jobOptions);
}

/**
 * Add job to Email Delivery queue
 */
async function addEmailJob(type, data, options = {}) {
  const queue = queues[QUEUE_NAMES.EMAIL_DELIVERY];
  if (!queue) throw new Error('Email Delivery queue not initialized');

  return queue.add(type, data, {
    ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.EMAIL_DELIVERY],
    ...options,
  });
}

/**
 * Add job to Pattern Detection queue
 */
async function addPatternDetectionJob(type, data, options = {}) {
  const queue = queues[QUEUE_NAMES.PATTERN_DETECTION];
  if (!queue) throw new Error('Pattern Detection queue not initialized');

  return queue.add(type, data, {
    ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.PATTERN_DETECTION],
    ...options,
  });
}

/**
 * Add job to Cache Warm queue
 */
async function addCacheJob(type, data, options = {}) {
  const queue = queues[QUEUE_NAMES.CACHE_WARM];
  if (!queue) throw new Error('Cache Warm queue not initialized');

  return queue.add(type, data, {
    ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.CACHE_WARM],
    ...options,
  });
}

/**
 * Add a flow of dependent jobs
 * Example: Trade created -> Emotion detection -> Post-trade analysis
 */
async function addJobFlow(flow) {
  if (!flowProducer) throw new Error('Flow producer not initialized');
  return flowProducer.add(flow);
}

/**
 * Create a trade processing flow
 */
async function createTradeProcessingFlow(tradeId, userId, tradeData) {
  const flow = {
    name: JOB_TYPES.POST_TRADE_ANALYSIS,
    queueName: QUEUE_NAMES.AI_ANALYSIS,
    data: { tradeId, userId, tradeData },
    children: [
      {
        name: JOB_TYPES.EMOTION_DETECTION,
        queueName: QUEUE_NAMES.AI_ANALYSIS,
        data: { 
          tradeId, 
          text: tradeData.reason || '',
          exitText: tradeData.exitReason || '',
        },
      },
      {
        name: JOB_TYPES.BEHAVIORAL_ANALYSIS,
        queueName: QUEUE_NAMES.PATTERN_DETECTION,
        data: { userId, tradeId },
      },
    ],
  };

  return addJobFlow(flow);
}

/**
 * Get queue statistics
 */
async function getQueueStats(queueName) {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue ${queueName} not found`);

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ]);

  return {
    name: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + delayed + paused,
  };
}

/**
 * Get all queue statistics
 */
async function getAllQueueStats() {
  const stats = {};
  for (const name of Object.values(QUEUE_NAMES)) {
    stats[name] = await getQueueStats(name);
  }
  return stats;
}

/**
 * Pause a queue
 */
async function pauseQueue(queueName) {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  await queue.pause();
  console.log(`[Queue:${queueName}] Paused`);
}

/**
 * Resume a queue
 */
async function resumeQueue(queueName) {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  await queue.resume();
  console.log(`[Queue:${queueName}] Resumed`);
}

/**
 * Drain a queue (remove all jobs)
 */
async function drainQueue(queueName) {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  await queue.drain();
  console.log(`[Queue:${queueName}] Drained`);
}

/**
 * Clean old jobs from a queue
 */
async function cleanQueue(queueName, grace = 3600000, status = 'completed') {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  
  const removed = await queue.clean(grace, 1000, status);
  console.log(`[Queue:${queueName}] Cleaned ${removed.length} ${status} jobs`);
  return removed.length;
}

/**
 * Graceful shutdown
 */
async function closeQueues() {
  console.log('[Queues] Shutting down...');

  // Close flow producer
  if (flowProducer) {
    await flowProducer.close();
  }

  // Close queue events
  for (const events of Object.values(queueEvents)) {
    await events.close();
  }

  // Close queues
  for (const queue of Object.values(queues)) {
    await queue.close();
  }

  // Close connection
  if (connection) {
    await connection.quit();
  }

  isInitialized = false;
  queues = {};
  queueEvents = {};
  flowProducer = null;

  console.log('[Queues] Shutdown complete');
}

module.exports = {
  // Initialization
  initializeQueues,
  closeQueues,

  // Queue names and job types
  QUEUE_NAMES,
  JOB_TYPES,

  // Job addition helpers
  addAIAnalysisJob,
  addEmailJob,
  addPatternDetectionJob,
  addCacheJob,
  addJobFlow,
  createTradeProcessingFlow,

  // Queue management
  getQueueStats,
  getAllQueueStats,
  pauseQueue,
  resumeQueue,
  drainQueue,
  cleanQueue,

  // Direct queue access (for workers)
  getQueues: () => queues,
  getQueueEvents: () => queueEvents,
  getFlowProducer: () => flowProducer,
};
