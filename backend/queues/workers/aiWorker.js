/**
 * AI Analysis Worker
 * 
 * Processes AI-related jobs:
 * - Post-trade analysis (Gemini)
 * - Emotion detection (FinBERT)
 * - Quiz/flashcard generation (Gemini)
 * - Weekly insights (Gemini)
 * - Coach advice (Gemini)
 */

const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { QUEUE_NAMES, JOB_TYPES } = require('../index');

// Import services (lazy load to avoid circular dependencies)
let emotionDetectService;
let postTradeAnalysisService;
let quizFlashcardService;
let insightsService;
let tradingCoachService;
let Trade;

const loadServices = () => {
  if (!emotionDetectService) {
    emotionDetectService = require('../../services/emotionDetectService');
    postTradeAnalysisService = require('../../services/postTradeAnalysisService');
    quizFlashcardService = require('../../services/quizFlashcardService');
    insightsService = require('../../services/insightsService');
    tradingCoachService = require('../../services/tradingCoachService');
    Trade = require('../../models/Trade');
  }
};

// Redis connection for worker
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
 * Process AI analysis jobs
 */
async function processJob(job) {
  loadServices();
  
  const { name, data } = job;
  
  console.log(`[AIWorker] Processing job ${job.id}: ${name}`);

  try {
    switch (name) {
      case JOB_TYPES.EMOTION_DETECTION:
        return await processEmotionDetection(job, data);

      case JOB_TYPES.POST_TRADE_ANALYSIS:
        return await processPostTradeAnalysis(job, data);

      case JOB_TYPES.QUIZ_GENERATION:
        return await processQuizGeneration(job, data);

      case JOB_TYPES.FLASHCARD_GENERATION:
        return await processFlashcardGeneration(job, data);

      case JOB_TYPES.WEEKLY_INSIGHTS:
        return await processWeeklyInsights(job, data);

      case JOB_TYPES.COACH_ADVICE:
        return await processCoachAdvice(job, data);

      default:
        throw new Error(`Unknown job type: ${name}`);
    }
  } catch (error) {
    console.error(`[AIWorker] Job ${job.id} failed:`, error.message);
    throw error;
  }
}

/**
 * Process emotion detection
 */
async function processEmotionDetection(job, data) {
  const { tradeId, text, exitText } = data;

  await job.updateProgress(10);

  // Detect emotion in entry reason
  let entryEmotion = null;
  if (text) {
    entryEmotion = await emotionDetectService.detectEmotion(text);
    await job.updateProgress(40);
  }

  // Detect emotion in exit reason
  let exitEmotion = null;
  if (exitText) {
    exitEmotion = await emotionDetectService.detectEmotion(exitText);
    await job.updateProgress(70);
  }

  // Update trade if tradeId provided
  if (tradeId) {
    const update = {};
    if (entryEmotion) {
      update.emotionAnalysis = entryEmotion;
    }
    if (exitEmotion) {
      update.exitEmotionAnalysis = exitEmotion;
    }

    if (Object.keys(update).length > 0) {
      await Trade.findByIdAndUpdate(tradeId, update);
    }
  }

  await job.updateProgress(100);

  return {
    tradeId,
    entryEmotion,
    exitEmotion,
  };
}

/**
 * Process post-trade analysis
 */
async function processPostTradeAnalysis(job, data) {
  const { tradeId, userId, tradeData } = data;

  await job.updateProgress(10);

  // Get trade from database if not provided
  let trade = tradeData;
  if (!trade && tradeId) {
    trade = await Trade.findById(tradeId).lean();
    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }
  }

  await job.updateProgress(30);

  // Check if trade has exit data (required for post-trade analysis)
  if (!trade.exitPrice && !trade.exitReason && !trade.result) {
    return { skipped: true, reason: 'No exit data' };
  }

  // Generate analysis
  const analysis = await postTradeAnalysisService.generatePostTradeAnalysis(trade);
  await job.updateProgress(80);

  // Update trade with analysis
  if (tradeId) {
    await Trade.findByIdAndUpdate(tradeId, {
      postTradeAnalysis: analysis,
    });
  }

  await job.updateProgress(100);

  return {
    tradeId,
    analysis,
  };
}

/**
 * Process quiz generation
 */
async function processQuizGeneration(job, data) {
  const { userId, count = 5, difficulty = 'medium' } = data;

  await job.updateProgress(10);

  const quiz = await quizFlashcardService.generatePersonalizedQuiz(
    userId,
    count,
    difficulty
  );

  await job.updateProgress(100);

  return {
    userId,
    quiz,
    questionCount: quiz.quiz?.length || 0,
  };
}

/**
 * Process flashcard generation
 */
async function processFlashcardGeneration(job, data) {
  const { userId, count = 10, category = 'all' } = data;

  await job.updateProgress(10);

  const flashcards = await quizFlashcardService.generatePersonalizedFlashcards(
    userId,
    count,
    category
  );

  await job.updateProgress(100);

  return {
    userId,
    flashcards,
    cardCount: flashcards.flashcards?.length || 0,
  };
}

/**
 * Process weekly insights
 */
async function processWeeklyInsights(job, data) {
  const { userId, startDate, endDate } = data;

  await job.updateProgress(10);

  const insights = await insightsService.getWeeklyInsights(
    userId,
    startDate,
    endDate
  );

  await job.updateProgress(100);

  return {
    userId,
    insights,
    period: { startDate, endDate },
  };
}

/**
 * Process coach advice
 */
async function processCoachAdvice(job, data) {
  const { userId, context } = data;

  await job.updateProgress(10);

  const advice = await tradingCoachService.getCoachingAdvice(userId, context);

  await job.updateProgress(100);

  return {
    userId,
    advice,
  };
}

/**
 * Start the AI worker
 */
function startWorker(options = {}) {
  const {
    concurrency = 5,
    limiter = {
      max: 10,
      duration: 1000, // Max 10 jobs per second (rate limit AI APIs)
    },
  } = options;

  worker = new Worker(
    QUEUE_NAMES.AI_ANALYSIS,
    processJob,
    {
      connection: createConnection(),
      concurrency,
      limiter,
      settings: {
        stalledInterval: 30000,
        maxStalledCount: 2,
      },
    }
  );

  // Event handlers
  worker.on('completed', (job, result) => {
    console.log(`[AIWorker] Job ${job.id} completed:`, job.name);
  });

  worker.on('failed', (job, error) => {
    console.error(`[AIWorker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[AIWorker] Worker error:', error.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[AIWorker] Job ${jobId} stalled`);
  });

  console.log(`[AIWorker] Started with concurrency ${concurrency}`);

  return worker;
}

/**
 * Stop the worker
 */
async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[AIWorker] Stopped');
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
  processJob, // Export for testing
};
