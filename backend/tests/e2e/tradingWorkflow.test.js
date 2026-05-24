const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../backend/server');
const User = require('../../backend/models/User');
const Trade = require('../../backend/models/Trade');

describe('E2E: Complete Trading Workflow', () => {
  
  let authToken;
  let userId;
  let tradeId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await Trade.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Complete User Journey: Registration to Learning', () => {
    
    test('Step 1: User registers successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'e2euser@example.com',
          password: 'SecurePass123!',
          name: 'E2E Test User'
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('e2euser@example.com');
      
      authToken = response.body.token;
      userId = response.body.user._id;
    });

    test('Step 2: User logs in', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'e2euser@example.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      authToken = response.body.token;
    });

    test('Step 3: User creates first trade (open position)', async () => {
      const response = await request(app)
        .post('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'AAPL',
          entryPrice: 150,
          quantity: 10,
          direction: 'long',
          stopLoss: 145,
          takeProfit: 160,
          reason: 'Strong breakout above resistance with high volume',
          assetType: 'stock'
        })
        .expect(201);

      expect(response.body.symbol).toBe('AAPL');
      expect(response.body).toHaveProperty('emotionAnalysis');
      expect(response.body.tags).toContain('breakout');
      expect(response.body.tags).toContain('resistance');
      
      tradeId = response.body._id;
    });

    test('Step 4: User views their trades', async () => {
      const response = await request(app)
        .get('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.trades).toHaveLength(1);
      expect(response.body.trades[0].symbol).toBe('AAPL');
    });

    test('Step 5: User closes the trade with exit data', async () => {
      const response = await request(app)
        .patch(`/api/trades/${tradeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exitPrice: 158,
          exitReason: 'Hit near take profit, took profits early',
          result: 'win',
          profitLoss: 800,
          postTradeReview: {
            mistakes: 'None',
            planFollowed: 'Yes, followed plan well',
            lessons: 'Patience paid off, good risk management'
          }
        })
        .expect(200);

      expect(response.body.exitPrice).toBe(158);
      expect(response.body.result).toBe('win');
      expect(response.body).toHaveProperty('exitEmotionAnalysis');
      expect(response.body).toHaveProperty('postTradeAnalysis');
      expect(response.body.postTradeAnalysis).toHaveProperty('recommendations');
    }, 35000);

    test('Step 6: User creates more trades to build history', async () => {
      const trades = [
        {
          symbol: 'TSLA',
          entryPrice: 200,
          exitPrice: 195,
          quantity: 5,
          direction: 'long',
          reason: 'FOMO entry, afraid to miss the rally',
          exitReason: 'Panic sold when it dropped',
          result: 'loss',
          profitLoss: -250,
          postTradeReview: {
            mistakes: 'Entered with fear, moved stop-loss away',
            lessons: 'Never trade with FOMO'
          }
        },
        {
          symbol: 'NVDA',
          entryPrice: 500,
          exitPrice: 520,
          quantity: 2,
          direction: 'long',
          reason: 'Clear support level bounce, waited for confirmation',
          exitReason: 'Hit take profit',
          result: 'win',
          profitLoss: 400,
          postTradeReview: {
            mistakes: 'None',
            lessons: 'Support levels work well'
          }
        }
      ];

      for (const trade of trades) {
        await request(app)
          .post('/api/trades')
          .set('Authorization', `Bearer ${authToken}`)
          .send(trade)
          .expect(201);
      }
    }, 60000);

    test('Step 7: User views trading statistics', async () => {
      const response = await request(app)
        .get('/api/trades/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overall.totalTrades).toBe(3);
      expect(response.body.overall.winningTrades).toBe(2);
      expect(response.body.overall.losingTrades).toBe(1);
      expect(response.body.byTag).toBeDefined();
    });

    test('Step 8: User requests weekly insights', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/insights/weekly?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('emotionAnalysis');
      expect(response.body).toHaveProperty('aiInsights');
      expect(response.body.statistics.totalTrades).toBeGreaterThan(0);
    }, 35000);

    test('Step 9: User generates personalized quiz', async () => {
      const response = await request(app)
        .get('/api/explain/quiz?count=3&difficulty=medium')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('quiz');
      expect(response.body.basedOnTrades).toBeGreaterThan(0);
      expect(response.body.userContext).toHaveProperty('winRate');
    }, 35000);

    test('Step 10: User generates personalized flashcards', async () => {
      const response = await request(app)
        .get('/api/explain/flashcards?count=5&category=all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('flashcards');
      expect(response.body.basedOnTrades).toBeGreaterThan(0);
    }, 35000);

    test('Step 11: User asks for explanation of trading term', async () => {
      const response = await request(app)
        .post('/api/explain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'What is FOMO in trading?',
          context: 'trading'
        })
        .expect(200);

      expect(response.body).toHaveProperty('explanation');
    }, 35000);

    test('Step 12: User deletes a trade', async () => {
      // Get a trade to delete
      const tradesResponse = await request(app)
        .get('/api/trades')
        .set('Authorization', `Bearer ${authToken}`);

      const tradeToDelete = tradesResponse.body.trades[0]._id;

      await request(app)
        .delete(`/api/trades/${tradeToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify it's deleted
      const afterDelete = await request(app)
        .get('/api/trades')
        .set('Authorization', `Bearer ${authToken}`);

      expect(afterDelete.body.trades.length).toBe(tradesResponse.body.trades.length - 1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('Should handle invalid trade data gracefully', async () => {
      const response = await request(app)
        .post('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'INVALID',
          // Missing required fields
        })
        .expect(500);

      expect(response.body).toHaveProperty('message');
    });

    test('Should handle non-existent trade ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/api/trades/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('Should handle quiz generation with minimal data', async () => {
      // Create new user with no trades
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'minimal@example.com',
          password: 'SecurePass123!',
          name: 'Minimal User'
        });

      const minimalToken = newUserResponse.body.token;

      const response = await request(app)
        .get('/api/explain/quiz')
        .set('Authorization', `Bearer ${minimalToken}`)
        .expect(200);

      expect(response.body.message).toContain('Not enough trading data');
    });
  });
});
