module.exports = {
  // API Configuration
  API_PREFIX: '/api',
  
  // JWT Configuration
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // AI Services Configuration
  AI_SERVICES: {
    COHERE: {
      MODEL: 'command-a-03-2025',
      MAX_TOKENS: 300,
      TEMPERATURE: 0.7
    },
    HUGGINGFACE: {
      MODEL: 'ProsusAI/finbert'  // Financial sentiment analysis model
    }
  },
  
  // Trade Categories
  TRADE_CATEGORIES: {
    ASSET_TYPES: ['crypto', 'stocks', 'forex'],
    DIRECTIONS: ['long', 'short'],
    RESULTS: ['win', 'loss', 'breakeven']
  },
  
  // Weekly Insights Configuration
  INSIGHTS: {
    CRON_SCHEDULE: '0 0 * * 0', // Every Sunday at midnight
    MAX_TRADES_ANALYZED: 100
  },
  
  // Error Messages
  ERROR_MESSAGES: {
    DB_CONNECTION: 'Database connection failed',
    AUTH_REQUIRED: 'Authentication required',
    INVALID_TOKEN: 'Invalid token',
    USER_NOT_FOUND: 'User not found',
    TRADE_NOT_FOUND: 'Trade not found'
  }
}; 