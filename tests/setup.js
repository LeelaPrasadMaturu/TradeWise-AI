// Test setup and global configuration
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradewise-test';

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to create mock trade data
  createMockTrade: (overrides = {}) => ({
    symbol: 'AAPL',
    entryPrice: 150,
    quantity: 10,
    direction: 'long',
    reason: 'Strong breakout pattern',
    assetType: 'stock',
    ...overrides
  }),

  // Helper to create mock user data
  createMockUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'Test123!@#',
    name: 'Test User',
    ...overrides
  }),

  // Helper to create completed trade
  createCompletedTrade: (overrides = {}) => ({
    symbol: 'AAPL',
    entryPrice: 150,
    exitPrice: 155,
    quantity: 10,
    direction: 'long',
    reason: 'Strong breakout pattern',
    exitReason: 'Hit take profit',
    result: 'win',
    profitLoss: 500,
    assetType: 'stock',
    ...overrides
  })
};
