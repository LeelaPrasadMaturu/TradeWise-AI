const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../backend/server');
const User = require('../../backend/models/User');
const Trade = require('../../backend/models/Trade');

describe('Learning Features Integration Tests', () => {
  
  let authToken;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'learner@example.com',
        password: 'SecurePass123!',
        name: 'Test Learner'
      });

    authToken = response.body.token;
    userId = response.body.user._id;
  });

  afterAll(async () => {
    await Trade.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Trade.deleteMany({ user: userId });
  });

  describe('GET /api/insights/weekly', () => {
    
    test('should return message when no trades exist', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-07';

      const response = await request(app)
        .get(`/api/insights/weekly?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('No trades found');
    });

    test('should generate insights when trades exist', async () => {
      // Create test trades
      await Trade.create([
        {
          user: userId,
          symbol: 'AAPL',
          entryPrice: 150,
          exitPrice: 155,
          quantity: 10,
          direction: 'long',
          result: 'win',
          profitLoss: 500,
          emotionAnalysis: { detected: 'positive' },
          tags: ['support'],
          tradeDate: new Date('2025-01-02')
        },
        {
          user: userId,
          symbol: 'TSLA',
          entryPrice: 200,
          exitPrice: 195,
          quantity: 5,
          direction: 'long',
          result: 'loss',
          profitLoss: -250,
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo'],
          tradeDate: new Date('2025-01-03')
        }
      ]);

      const response = await request(app)
        .get('/api/insights/weekly?startDate=2025-01-01&endDate=2025-01-07')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('emotionAnalysis');
      expect(response.body).toHaveProperty('tagAnalysis');
      expect(response.body).toHaveProperty('trades');
      expect(response.body).toHaveProperty('aiInsights');
      expect(response.body.statistics.totalTrades).toBe(2);
    }, 35000);

    test('should require authentication', async () => {
      await request(app)
        .get('/api/insights/weekly?startDate=2025-01-01&endDate=2025-01-07')
        .expect(401);
    });
  });

  describe('GET /api/explain/quiz', () => {
    
    test('should return message when insufficient trading data', async () => {
      const response = await request(app)
        .get('/api/explain/quiz?count=5&difficulty=medium')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('Not enough trading data');
    });

    test('should generate personalized quiz from trading history', async () => {
      // Create trades with patterns
      await Trade.create([
        {
          user: userId,
          symbol: 'AAPL',
          entryPrice: 150,
          exitPrice: 145,
          quantity: 10,
          direction: 'long',
          result: 'loss',
          profitLoss: -500,
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo'],
          postTradeReview: {
            mistakes: 'Moved stop-loss away',
            lessons: 'Never move stop-loss'
          },
          postTradeAnalysis: {
            recommendations: ['Avoid FOMO trades', 'Respect stop-loss']
          },
          tradeDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        },
        {
          user: userId,
          symbol: 'TSLA',
          entryPrice: 200,
          exitPrice: 210,
          quantity: 5,
          direction: 'long',
          result: 'win',
          profitLoss: 500,
          emotionAnalysis: { detected: 'positive' },
          tags: ['support'],
          tradeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        }
      ]);

      const response = await request(app)
        .get('/api/explain/quiz?count=3&difficulty=medium')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('quiz');
      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body).toHaveProperty('basedOnTrades');
      expect(response.body.basedOnTrades).toBe(2);
    }, 35000);

    test('should support different difficulty levels', async () => {
      await Trade.create({
        user: userId,
        symbol: 'AAPL',
        entryPrice: 150,
        quantity: 10,
        direction: 'long',
        result: 'loss',
        profitLoss: -100,
        emotionAnalysis: { detected: 'negative' },
        tradeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get('/api/explain/quiz?count=2&difficulty=hard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    }, 35000);

    test('should require authentication', async () => {
      await request(app)
        .get('/api/explain/quiz')
        .expect(401);
    });
  });

  describe('GET /api/explain/flashcards', () => {
    
    test('should return message when insufficient trading data', async () => {
      const response = await request(app)
        .get('/api/explain/flashcards?count=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('Not enough trading data');
    });

    test('should generate personalized flashcards from trading history', async () => {
      await Trade.create([
        {
          user: userId,
          symbol: 'AAPL',
          entryPrice: 150,
          exitPrice: 145,
          quantity: 10,
          direction: 'long',
          result: 'loss',
          profitLoss: -500,
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo'],
          postTradeReview: {
            mistakes: 'Entered with fear',
            lessons: 'Wait for emotional clarity'
          },
          postTradeAnalysis: {
            recommendations: ['Avoid fear-based entries']
          },
          tradeDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        }
      ]);

      const response = await request(app)
        .get('/api/explain/flashcards?count=5&category=all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('flashcards');
      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body).toHaveProperty('basedOnTrades');
    }, 35000);

    test('should support different categories', async () => {
      await Trade.create({
        user: userId,
        symbol: 'AAPL',
        entryPrice: 150,
        quantity: 10,
        direction: 'long',
        result: 'loss',
        profitLoss: -100,
        emotionAnalysis: { detected: 'negative' },
        tradeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get('/api/explain/flashcards?count=5&category=emotions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    }, 35000);

    test('should require authentication', async () => {
      await request(app)
        .get('/api/explain/flashcards')
        .expect(401);
    });
  });

  describe('POST /api/explain', () => {
    
    test('should explain trading term', async () => {
      const response = await request(app)
        .post('/api/explain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'What is a stop-loss?',
          context: 'trading'
        })
        .expect(200);

      expect(response.body).toHaveProperty('explanation');
    }, 35000);

    test('should require text parameter', async () => {
      const response = await request(app)
        .post('/api/explain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('required');
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/explain')
        .send({ text: 'What is FOMO?' })
        .expect(401);
    });
  });
});
