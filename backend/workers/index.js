/**
 * Worker Process Entry Point
 * 
 * Starts all BullMQ workers and Kafka consumers for background processing.
 * Run: node workers/index.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { initializeQueues, closeQueues } = require('../queues');
const { startWorker: startAIWorker, stopWorker: stopAIWorker } = require('../queues/workers/aiWorker');
const { startWorker: startEmailWorker, stopWorker: stopEmailWorker } = require('../queues/workers/emailWorker');
const { startWorker: startPatternWorker, stopWorker: stopPatternWorker } = require('../queues/workers/patternWorker');
const { initializeKafka, disconnect: disconnectKafka } = require('../events/kafkaClient');
const { startTradeConsumer } = require('../events/handlers/tradeHandler');
const { startAlertConsumer } = require('../events/handlers/alertHandler');
const redisService = require('../services/redisService');

// Track running state
let isShuttingDown = false;

/**
 * Connect to MongoDB
 */
async function connectMongo() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradewise';
  
  try {
    await mongoose.connect(mongoUri);
    console.log('[Worker] MongoDB connected');
  } catch (error) {
    console.error('[Worker] MongoDB connection failed:', error.message);
    throw error;
  }
}

/**
 * Initialize all services
 */
async function initialize() {
  console.log('[Worker] Starting initialization...');

  // Connect to MongoDB
  await connectMongo();

  // Connect to Redis
  await redisService.connect();

  // Initialize BullMQ queues
  await initializeQueues();

  // Initialize Kafka (optional - don't fail if unavailable)
  try {
    await initializeKafka();
  } catch (error) {
    console.warn('[Worker] Kafka initialization failed (continuing without):', error.message);
  }

  console.log('[Worker] Initialization complete');
}

/**
 * Start all workers
 */
async function startWorkers() {
  console.log('[Worker] Starting workers...');

  // Start BullMQ workers
  startAIWorker({ concurrency: 5 });
  startEmailWorker({ concurrency: 3 });
  startPatternWorker({ concurrency: 3 });

  // Start Kafka consumers (optional)
  try {
    await startTradeConsumer();
    await startAlertConsumer();
    console.log('[Worker] Kafka consumers started');
  } catch (error) {
    console.warn('[Worker] Kafka consumers failed to start:', error.message);
  }

  console.log('[Worker] All workers started');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  if (isShuttingDown) {
    console.log('[Worker] Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`[Worker] ${signal} received, initiating graceful shutdown...`);

  try {
    // Stop workers (they will finish current jobs)
    console.log('[Worker] Stopping BullMQ workers...');
    await Promise.all([
      stopAIWorker(),
      stopEmailWorker(),
      stopPatternWorker(),
    ]);

    // Close queues
    console.log('[Worker] Closing queues...');
    await closeQueues();

    // Disconnect Kafka
    console.log('[Worker] Disconnecting Kafka...');
    await disconnectKafka();

    // Disconnect Redis
    console.log('[Worker] Disconnecting Redis...');
    await redisService.disconnect();

    // Disconnect MongoDB
    console.log('[Worker] Disconnecting MongoDB...');
    await mongoose.disconnect();

    console.log('[Worker] Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Worker] Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('[Worker] TradeWise AI Worker Process');
  console.log('[Worker] Node.js version:', process.version);
  console.log('[Worker] Environment:', process.env.NODE_ENV || 'development');

  // Setup signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[Worker] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Worker] Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });

  try {
    await initialize();
    await startWorkers();

    // Keep process alive
    console.log('[Worker] Worker process running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('[Worker] Fatal error during startup:', error);
    process.exit(1);
  }
}

// Run
main();
