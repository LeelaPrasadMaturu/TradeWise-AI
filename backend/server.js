require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const swaggerUi = require('swagger-ui-express');
const { createRateLimiter } = require('./middlewares/rateLimit');
const { createCombinedLimiter } = require('./middlewares/redisRateLimit');
const swaggerSpecs = require('./config/swagger');
const connectDB = require('./config/db');
const constants = require('./config/constants');

// Infrastructure imports
const redisService = require('./services/redisService');
const { initializeKafka, disconnect: disconnectKafka, healthCheck: kafkaHealthCheck } = require('./events/kafkaClient');
const { initializeQueues, closeQueues, getAllQueueStats } = require('./queues');
const { httpMetricsMiddleware, metricsEndpoint } = require('./utils/metrics');
const { circuitBreakers, getAllCircuitStatus } = require('./utils/circuitBreaker');

// Import routes
const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const explainRoutes = require('./routes/explainRoutes');
const insightRoutes = require('./routes/insightRoutes');
const alertRoutes = require('./routes/alertRoutes');
const priceRoutes = require('./routes/priceRoutes');
const importRoutes = require('./routes/importRoutes');
const behavioralRoutes = require('./routes/behavioralRoutes');
const rulesRoutes = require('./routes/rulesRoutes');
const disciplineRoutes = require('./routes/disciplineRoutes');
const coachRoutes = require('./routes/coachRoutes');
const reportRoutes = require('./routes/reportRoutes');
const edgeRoutes = require('./routes/edgeRoutes');
const playbookRoutes = require('./routes/playbookRoutes');

// Import scheduler
const { initScheduler } = require('./services/schedulerService');

// Track server state for graceful shutdown
let server = null;
let isShuttingDown = false;

// Create Express app
const app = express();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prometheus metrics middleware
app.use(httpMetricsMiddleware);

// Global basic rate limit: 300 req/min per IP (in-memory fallback)
app.use(createRateLimiter({ window: '1m', max: 300 }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Prometheus metrics endpoint
app.get('/metrics', metricsEndpoint);

// Basic health check
app.get('/health', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Comprehensive health check with all services
app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {}
  };

  // Check MongoDB
  try {
    const mongoose = require('mongoose');
    health.services.mongodb = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch (err) {
    health.services.mongodb = 'error';
  }

  // Check Redis
  try {
    const redisPing = await redisService.ping();
    health.services.redis = redisPing ? 'connected' : 'disconnected';
  } catch (err) {
    health.services.redis = 'unavailable';
  }

  // Check Kafka
  try {
    const kafkaStatus = await kafkaHealthCheck();
    health.services.kafka = kafkaStatus ? 'connected' : 'disconnected';
  } catch (err) {
    health.services.kafka = 'unavailable';
  }

  // Queue stats
  try {
    health.queues = await getAllQueueStats();
  } catch (err) {
    health.queues = 'unavailable';
  }

  // Circuit breaker status
  try {
    health.circuitBreakers = getAllCircuitStatus();
  } catch (err) {
    health.circuitBreakers = 'unavailable';
  }

  // Determine overall health
  const criticalServices = ['mongodb'];
  const allCriticalHealthy = criticalServices.every(
    s => health.services[s] === 'connected'
  );
  
  health.status = allCriticalHealthy ? 'ok' : 'degraded';
  res.status(allCriticalHealthy ? 200 : 503).json(health);
});

// Routes
// Tighter limits for sensitive routes
const authLimiter = createRateLimiter({ window: '15m', max: 100 });
const writeLimiter = createRateLimiter({ window: '1m', max: 60 });
const monitorLimiter = createRateLimiter({ window: '1m', max: 10 });

app.use(`${constants.API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${constants.API_PREFIX}/trades`, writeLimiter, tradeRoutes);
app.use(`${constants.API_PREFIX}/explain`, writeLimiter, explainRoutes);
app.use(`${constants.API_PREFIX}/insights`, writeLimiter, insightRoutes);
app.use(`${constants.API_PREFIX}/alerts`, monitorLimiter, alertRoutes);
app.use(`${constants.API_PREFIX}/prices`, writeLimiter, priceRoutes);
app.use(`${constants.API_PREFIX}/import`, writeLimiter, importRoutes);
app.use(`${constants.API_PREFIX}/behavioral`, writeLimiter, behavioralRoutes);
app.use(`${constants.API_PREFIX}/rules`, writeLimiter, rulesRoutes);
app.use(`${constants.API_PREFIX}/discipline`, writeLimiter, disciplineRoutes);
app.use(`${constants.API_PREFIX}/coach`, writeLimiter, coachRoutes);
app.use(`${constants.API_PREFIX}/reports`, writeLimiter, reportRoutes);
app.use(`${constants.API_PREFIX}/edge`, writeLimiter, edgeRoutes);
app.use(`${constants.API_PREFIX}/playbook`, writeLimiter, playbookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: constants.ERROR_MESSAGES[err.message] || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }
  
  // Allow in-flight requests to complete (max 30s)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Close infrastructure connections
  try {
    logger.info('Closing BullMQ queues...');
    await closeQueues();
  } catch (err) {
    logger.error('Error closing queues:', err);
  }
  
  try {
    logger.info('Disconnecting Kafka...');
    await disconnectKafka();
  } catch (err) {
    logger.error('Error disconnecting Kafka:', err);
  }
  
  try {
    logger.info('Disconnecting Redis...');
    await redisService.disconnect();
  } catch (err) {
    logger.error('Error disconnecting Redis:', err);
  }
  
  try {
    logger.info('Closing MongoDB...');
    const mongoose = require('mongoose');
    await mongoose.connection.close();
  } catch (err) {
    logger.error('Error closing MongoDB:', err);
  }
  
  logger.info('Graceful shutdown completed');
  process.exit(0);
};

// Start server with full infrastructure
const startServer = async () => {
  try {
    // 1. Connect to MongoDB (required)
    await connectDB();
    logger.info('MongoDB connected');
    
    // 2. Connect to Redis (optional, with fallback)
    try {
      await redisService.connect();
      logger.info('Redis connected');
    } catch (err) {
      logger.warn('Redis unavailable, using in-memory fallback:', err.message);
    }
    
    // 3. Initialize Kafka (optional, with fallback)
    try {
      if (process.env.ENABLE_KAFKA !== 'false') {
        await initializeKafka();
        logger.info('Kafka connected');
      }
    } catch (err) {
      logger.warn('Kafka unavailable, events will be processed synchronously:', err.message);
    }
    
    // 4. Initialize BullMQ queues
    try {
      await initializeQueues();
      logger.info('BullMQ queues initialized');
    } catch (err) {
      logger.warn('BullMQ unavailable:', err.message);
    }
    
    // 5. Initialize scheduled tasks (pre-market briefings, etc.)
    initScheduler();
    logger.info('Scheduler initialized');
    
    // 6. Start HTTP server
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`Health Check: http://localhost:${PORT}/health/detailed`);
    });
    
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  gracefulShutdown('UNHANDLED_REJECTION');
});

startServer(); 