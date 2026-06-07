/**
 * Pattern Detection Worker
 * 
 * Processes behavioral pattern detection jobs:
 * - Behavioral analysis
 * - Baseline recalculation
 * - Discipline score calculation
 */

const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { QUEUE_NAMES, JOB_TYPES } = require('../index');

// Lazy load services
let behavioralPatternService;
let disciplineScoreService;
let UserBaseline;
let User;

const loadServices = () => {
  if (!behavioralPatternService) {
    behavioralPatternService = require('../../services/behavioralPatternService');
    disciplineScoreService = require('../../services/disciplineScoreService');
    UserBaseline = require('../../models/UserBaseline');
    User = require('../../models/User');
  }
};

// Redis connection
const createConnection = () => {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_QUEUE_DB, 10) || 1,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

// Worker instance
let worker = null;

/**
 * Process pattern detection jobs
 */
async function processJob(job) {
  loadServices();
  
  const { name, data } = job;
  
  console.log(`[PatternWorker] Processing job ${job.id}: ${name}`);

  try {
    switch (name) {
      case JOB_TYPES.BEHAVIORAL_ANALYSIS:
        return await processBehavioralAnalysis(job, data);

      case JOB_TYPES.BASELINE_RECALCULATION:
        return await processBaselineRecalculation(job, data);

      case JOB_TYPES.DISCIPLINE_SCORE:
        return await processDisciplineScore(job, data);

      default:
        throw new Error(`Unknown job type: ${name}`);
    }
  } catch (error) {
    console.error(`[PatternWorker] Job ${job.id} failed:`, error.message);
    throw error;
  }
}

/**
 * Process behavioral analysis for a user
 */
async function processBehavioralAnalysis(job, data) {
  const { userId, tradeId, period = '30d' } = data;

  await job.updateProgress(10);

  // Get behavioral patterns
  const patterns = await behavioralPatternService.detectPatterns(userId, period);
  await job.updateProgress(50);

  // Get behavioral score
  const score = await behavioralPatternService.calculateBehavioralScore(userId, period);
  await job.updateProgress(70);

  // Get recommendations
  const recommendations = await behavioralPatternService.getRecommendations(userId, patterns);
  await job.updateProgress(90);

  await job.updateProgress(100);

  return {
    userId,
    tradeId,
    patterns: patterns.map(p => ({
      type: p.type,
      severity: p.severity,
      count: p.occurrences?.length || 0,
    })),
    score,
    recommendationCount: recommendations.length,
  };
}

/**
 * Recalculate user baseline metrics
 */
async function processBaselineRecalculation(job, data) {
  const { userId, force = false } = data;

  await job.updateProgress(10);

  // Check if recalculation is needed
  const existing = await UserBaseline.findOne({ userId });
  
  if (existing && !force) {
    const hoursSinceUpdate = (Date.now() - existing.updatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate < 24) {
      return { skipped: true, reason: 'Recently updated', hoursAgo: hoursSinceUpdate.toFixed(1) };
    }
  }

  await job.updateProgress(30);

  // Recalculate baseline
  const baseline = await behavioralPatternService.calculateUserBaseline(userId);
  await job.updateProgress(80);

  // Save baseline
  await UserBaseline.findOneAndUpdate(
    { userId },
    { 
      ...baseline,
      userId,
      updatedAt: new Date(),
    },
    { upsert: true }
  );

  await job.updateProgress(100);

  return {
    userId,
    tradingStyle: baseline.tradingStyle,
    totalTrades: baseline.totalTrades,
    avgDailyTrades: baseline.avgDailyTrades?.toFixed(2),
    avgHoldDuration: baseline.avgHoldDuration,
  };
}

/**
 * Calculate discipline score for a user
 */
async function processDisciplineScore(job, data) {
  const { userId, period = '7d' } = data;

  await job.updateProgress(10);

  // Get discipline score
  const score = await disciplineScoreService.getDisciplineScore(userId, period);
  await job.updateProgress(50);

  // Get compliance breakdown
  const breakdown = await disciplineScoreService.getComplianceBreakdown(userId, period);
  await job.updateProgress(70);

  // Get correlation with win rate
  const correlation = await disciplineScoreService.getWinRateCorrelation(userId);
  await job.updateProgress(90);

  await job.updateProgress(100);

  return {
    userId,
    period,
    score: score.score,
    totalTrades: score.totalTrades,
    compliantTrades: score.compliantTrades,
    ruleBreakdown: breakdown.length,
    winRateWhenCompliant: correlation.winRateWhenCompliant?.toFixed(1),
    winRateWhenViolating: correlation.winRateWhenViolating?.toFixed(1),
  };
}

/**
 * Start the pattern detection worker
 */
function startWorker(options = {}) {
  const {
    concurrency = 3,
    limiter = {
      max: 5,
      duration: 1000,
    },
  } = options;

  worker = new Worker(
    QUEUE_NAMES.PATTERN_DETECTION,
    processJob,
    {
      connection: createConnection(),
      concurrency,
      limiter,
      settings: {
        stalledInterval: 60000,
        maxStalledCount: 2,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[PatternWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[PatternWorker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[PatternWorker] Worker error:', error.message);
  });

  console.log(`[PatternWorker] Started with concurrency ${concurrency}`);

  return worker;
}

/**
 * Stop the worker
 */
async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[PatternWorker] Stopped');
  }
}

/**
 * Get worker status
 */
function getWorkerStatus() {
  if (!worker) {
    return { running: false };
  }

  return {
    running: worker.isRunning(),
    paused: worker.isPaused(),
    name: worker.name,
  };
}

module.exports = {
  startWorker,
  stopWorker,
  getWorkerStatus,
  processJob,
};
