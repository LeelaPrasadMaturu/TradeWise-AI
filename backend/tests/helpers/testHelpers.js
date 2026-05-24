/**
 * Test Helper Utilities
 * Reusable functions for testing
 */

const mongoose = require('mongoose');

/**
 * Generate a valid MongoDB ObjectId
 */
function generateObjectId() {
  return new mongoose.Types.ObjectId();
}

/**
 * Create mock trade data with defaults
 */
function createMockTrade(overrides = {}) {
  return {
    symbol: 'AAPL',
    entryPrice: 150,
    quantity: 10,
    direction: 'long',
    reason: 'Strong breakout pattern',
    assetType: 'stock',
    ...overrides
  };
}

/**
 * Create completed trade with exit data
 */
function createCompletedTrade(overrides = {}) {
  return {
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
  };
}

/**
 * Create mock user data
 */
function createMockUser(overrides = {}) {
  return {
    email: 'test@example.com',
    password: 'Test123!@#',
    name: 'Test User',
    ...overrides
  };
}

/**
 * Create losing trade with emotional patterns
 */
function createLosingTrade(overrides = {}) {
  return {
    symbol: 'TSLA',
    entryPrice: 200,
    exitPrice: 190,
    quantity: 5,
    direction: 'long',
    reason: 'FOMO entry, afraid to miss out',
    exitReason: 'Panic sold',
    result: 'loss',
    profitLoss: -500,
    postTradeReview: {
      mistakes: 'Entered with fear, moved stop-loss',
      lessons: 'Never trade with FOMO'
    },
    ...overrides
  };
}

/**
 * Create winning trade with good discipline
 */
function createWinningTrade(overrides = {}) {
  return {
    symbol: 'NVDA',
    entryPrice: 500,
    exitPrice: 520,
    quantity: 2,
    direction: 'long',
    stopLoss: 495,
    takeProfit: 525,
    reason: 'Clear support level bounce, waited for confirmation',
    exitReason: 'Hit take profit',
    result: 'win',
    profitLoss: 400,
    postTradeReview: {
      mistakes: 'None',
      planFollowed: 'Yes',
      lessons: 'Patience and discipline work'
    },
    ...overrides
  };
}

/**
 * Mock FinBERT API response
 */
function mockFinBERTResponse(emotion = 'positive', score = 0.95) {
  return {
    data: [{
      label: emotion,
      score: score
    }]
  };
}

/**
 * Mock Gemini API response for quiz
 */
function mockGeminiQuizResponse(count = 5) {
  const quiz = [];
  for (let i = 1; i <= count; i++) {
    quiz.push({
      id: i,
      question: `Test question ${i}`,
      options: ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
      correctAnswer: 'A',
      explanation: `Explanation for question ${i}`,
      category: 'emotional-awareness',
      difficulty: 'medium'
    });
  }

  return {
    data: {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              quiz,
              summary: {
                focusAreas: ['emotional-awareness'],
                personalizedMessage: 'Test quiz'
              }
            })
          }]
        }
      }]
    }
  };
}

/**
 * Mock Gemini API response for flashcards
 */
function mockGeminiFlashcardResponse(count = 10) {
  const flashcards = [];
  for (let i = 1; i <= count; i++) {
    flashcards.push({
      id: i,
      front: `Question ${i}`,
      back: `Answer ${i}`,
      category: 'emotional-awareness',
      priority: 'high',
      actionableReminder: `Reminder ${i}`
    });
  }

  return {
    data: {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              flashcards,
              summary: {
                totalFlashcards: count,
                categories: ['emotional-awareness'],
                studyRecommendation: 'Review daily'
              }
            })
          }]
        }
      }]
    }
  };
}

/**
 * Mock Gemini API response for insights
 */
function mockGeminiInsightsResponse() {
  return {
    data: {
      candidates: [{
        content: {
          parts: [{
            text: 'Detailed AI-generated insights about your trading performance...'
          }]
        }
      }]
    }
  };
}

/**
 * Wait for a specified duration (for async operations)
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean up test database
 */
async function cleanupDatabase(models = []) {
  for (const model of models) {
    await model.deleteMany({});
  }
}

/**
 * Create authenticated request headers
 */
function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Assert response has required fields
 */
function assertTradeResponse(response) {
  expect(response).toHaveProperty('_id');
  expect(response).toHaveProperty('symbol');
  expect(response).toHaveProperty('entryPrice');
  expect(response).toHaveProperty('quantity');
  expect(response).toHaveProperty('direction');
  expect(response).toHaveProperty('user');
}

/**
 * Assert emotion analysis structure
 */
function assertEmotionAnalysis(emotionAnalysis) {
  expect(emotionAnalysis).toHaveProperty('detected');
  expect(emotionAnalysis).toHaveProperty('confidence');
  expect(emotionAnalysis).toHaveProperty('source');
  expect(['positive', 'negative', 'neutral']).toContain(emotionAnalysis.detected);
}

/**
 * Assert post-trade analysis structure
 */
function assertPostTradeAnalysis(postTradeAnalysis) {
  expect(postTradeAnalysis).toHaveProperty('generatedAt');
  expect(postTradeAnalysis).toHaveProperty('model');
  expect(postTradeAnalysis).toHaveProperty('summary');
  expect(postTradeAnalysis).toHaveProperty('recommendations');
  expect(Array.isArray(postTradeAnalysis.recommendations)).toBe(true);
}

/**
 * Generate date range for testing
 */
function getDateRange(daysAgo = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysAgo);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

module.exports = {
  generateObjectId,
  createMockTrade,
  createCompletedTrade,
  createMockUser,
  createLosingTrade,
  createWinningTrade,
  mockFinBERTResponse,
  mockGeminiQuizResponse,
  mockGeminiFlashcardResponse,
  mockGeminiInsightsResponse,
  wait,
  cleanupDatabase,
  authHeaders,
  assertTradeResponse,
  assertEmotionAnalysis,
  assertPostTradeAnalysis,
  getDateRange
};
