require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const swaggerUi = require('swagger-ui-express');
const { createRateLimiter } = require('./middlewares/rateLimit');
const swaggerSpecs = require('./config/swagger');
const connectDB = require('./config/db');
const constants = require('./config/constants');

// Import routes
const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const explainRoutes = require('./routes/explainRoutes');
const insightRoutes = require('./routes/insightRoutes');
const alertRoutes = require('./routes/alertRoutes');
const priceRoutes = require('./routes/priceRoutes');

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
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global basic rate limit: 300 req/min per IP
app.use(createRateLimiter({ window: '1m', max: 300 }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: constants.ERROR_MESSAGES[err.message] || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server only after DB connection
const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

startServer(); 