# TradeWise AI - Test Suite

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Test Environment
Create `.env.test` file (already provided):
```env
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/tradewise-test
JWT_SECRET=test-jwt-secret-key
```

### 3. Start MongoDB
Ensure MongoDB is running:
```bash
# Check if MongoDB is running
mongod --version

# Start MongoDB (if not running)
mongod
```

### 4. Run Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📁 Test Structure

```
tests/
├── setup.js                          # Global test configuration
├── helpers/
│   └── testHelpers.js               # Reusable test utilities
├── unit/                            # Unit tests (services)
│   ├── emotionDetectService.test.js # Emotion detection tests
│   ├── quizFlashcardService.test.js # Quiz/flashcard generation tests
│   └── insightsService.test.js      # Weekly insights tests
├── integration/                     # Integration tests (API routes)
│   ├── auth.test.js                 # Authentication API tests
│   ├── trades.test.js               # Trades API tests
│   └── learning.test.js             # Learning features API tests
└── e2e/                             # End-to-end tests (workflows)
    ├── tradingWorkflow.test.js      # Complete trading workflow
    └── learningJourney.test.js      # Learning from mistakes workflow
```

## 🧪 Test Categories

### Unit Tests (30 tests)
Tests individual service functions in isolation:
- ✅ Emotion detection with FinBERT
- ✅ Tag extraction from trade reasons
- ✅ Trading pattern analysis
- ✅ Quiz generation logic
- ✅ Flashcard generation logic
- ✅ Weekly insights calculation

**Run**: `npm run test:unit`

### Integration Tests (33 tests)
Tests API endpoints with database:
- ✅ User registration & login
- ✅ Trade CRUD operations
- ✅ Trade statistics
- ✅ Weekly insights API
- ✅ Quiz generation API
- ✅ Flashcard generation API
- ✅ AI explanations API

**Run**: `npm run test:integration`

### E2E Tests (22 tests)
Tests complete user workflows:
- ✅ Registration → Trading → Analysis → Learning
- ✅ Making mistakes → Getting insights → Improving
- ✅ Error handling and edge cases

**Run**: `npm run test:e2e`

## 📊 Coverage Report

After running `npm run test:coverage`, open:
```
coverage/lcov-report/index.html
```

**Target Coverage**: 80%+

## 🔧 Common Commands

```bash
# Run single test file
npm test -- tests/unit/emotionDetectService.test.js

# Run tests matching pattern
npm test -- -t "should analyze emotion"

# Run with verbose output
npm test -- --verbose

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Clear Jest cache
npm test -- --clearCache
```

## 🐛 Troubleshooting

### Tests Timeout
Some tests interact with AI APIs and may take longer:
```javascript
test('AI operation', async () => {
  // test code
}, 35000); // 35 second timeout
```

### MongoDB Connection Issues
1. Ensure MongoDB is running: `mongod`
2. Check connection string in `.env.test`
3. Verify test database is accessible

### Mock Not Working
Clear mocks between tests:
```javascript
afterEach(() => {
  jest.clearAllMocks();
});
```

### Authentication Failures
Verify JWT_SECRET is set in `.env.test`

## 📈 Test Metrics

| Category | Tests | Coverage |
|----------|-------|----------|
| Unit Tests | 30 | 85%+ |
| Integration Tests | 33 | 80%+ |
| E2E Tests | 22 | 75%+ |
| **Total** | **85+** | **80%+** |

## 🎯 Writing New Tests

### Example Unit Test
```javascript
const { myFunction } = require('../../backend/services/myService');

describe('MyService', () => {
  test('should do something', async () => {
    const result = await myFunction('input');
    expect(result).toBeDefined();
  });
});
```

### Example Integration Test
```javascript
const request = require('supertest');
const app = require('../../backend/server');

describe('API Tests', () => {
  test('should call endpoint', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toHaveProperty('data');
  });
});
```

## 🔍 Test Helpers

Use helper functions from `tests/helpers/testHelpers.js`:

```javascript
const {
  createMockTrade,
  createCompletedTrade,
  assertTradeResponse,
  mockFinBERTResponse
} = require('../helpers/testHelpers');

// Create test data
const trade = createMockTrade({ symbol: 'TSLA' });
const completedTrade = createCompletedTrade({ profitLoss: 500 });

// Assert response structure
assertTradeResponse(response.body);
```

## 📚 Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Main Testing Guide](../TESTING.md)

## ✅ Pre-Commit Checklist

Before committing code:
- [ ] All tests pass: `npm test`
- [ ] Coverage is >80%: `npm run test:coverage`
- [ ] No console errors or warnings
- [ ] New features have tests
- [ ] Tests are documented

---

**Happy Testing! 🎉**
