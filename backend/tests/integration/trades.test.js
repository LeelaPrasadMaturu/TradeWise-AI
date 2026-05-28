const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../backend/server');
const User = require('../../backend/models/User');
const Trade = require('../../backend/models/Trade');

describe('Trades API Integration Tests', () => {
  
  let authToken;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Create test user and get token
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'trader@example.com',
        password: 'SecurePass123!',
        name: 'Test Trader'
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

  describe('POST /api/trades', () => {
    
    test('should create an open trade successfully', async () => {
      const tradeData = {
        symbol: 'AAPL',
        entryPrice: 150,
        quantity: 10,
        direction: 'long',
        reason: 'Strong breakout above resistance'
      };

      const response = await request(app)
        .post('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tradeData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.symbol).toBe('AAPL');
      expect(response.body.entryPrice).toBe(150);
      expect(response.body).toHaveProperty('emotionAnalysis');
      expect(response.body).toHaveProperty('tags');
      expect(response.body.tags).toContain('breakout');
      expect(response.body.tags).toContain('resistance');
    });

    test('should create a closed trade with post-trade analysis', async () => {
      const tradeData = {
        symbol: 'TSLA',
        entryPrice: 200,
        exitPrice: 210,
        quantity: 5,
        direction: 'long',
        reason: 'Bullish divergence on RSI',
        exitReason: 'Hit take profit target',
        result: 'win',
        profitLoss: 500
      };

      const response = await request(app)
        .post('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tradeData)
        .expect(201);

      expect(response.body.symbol).toBe('TSLA');
      expect(response.body.exitPrice).toBe(210);
      expect(response.body).toHaveProperty('emotionAnalysis');
      expect(response.body).toHaveProperty('postTradeAnalysis');
    }, 35000); // Increased timeout for AI analysis

    test('should require authentication', async () => {
      const tradeData = {
        symbol: 'AAPL',
        entryPrice: 150,
        quantity: 10,
        direction: 'long'
      };

      await request(app)
        .post('/api/trades')
        .send(tradeData)
        .expect(401);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'AAPL'
          // missing required fields
        })
        .expect(500); // Will fail validation in model

      expect(response.body).toHaveProperty('message');
    });

    test('should extract tags from reason automatically', async () => {
      const response = await request(app)
        .post('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'NVDA',
          entryPrice: 500,
          quantity: 2,
          direction: 'long',
          reason: 'FOMO trade, price running up fast'
        })
        .expect(201);

      expect(response.body.tags).toContain('fomo');
    });
  });

  describe('GET /api/trades', () => {
    
    beforeEach(async () => {
      // Create some test trades
      await Trade.create([
        {
          user: userId,
          symbol: 'AAPL',
          entryPrice: 150,
          quantity: 10,
          direction: 'long',
          result: 'win',
          profitLoss: 100
        },
        {
          user: userId,
          symbol: 'TSLA',
          entryPrice: 200,
          quantity: 5,
          direction: 'short',
          result: 'loss',
          profitLoss: -50
        }
      ]);
    });

    test('should get all trades for authenticated user', async () => {
      const response = await request(app)
        .get('/api/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.trades).toHaveLength(2);
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/trades?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.trades).toHaveLength(1);
      expect(response.body.totalPages).toBe(2);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/trades')
        .expect(401);
    });
  });

  describe('GET /api/trades/stats', () => {
    
    beforeEach(async () => {
      await Trade.create([
        {
          user: userId,
          symbol: 'AAPL',
          entryPrice: 150,
          quantity: 10,
          direction: 'long',
          result: 'win',
          profitLoss: 500,
          tags: ['breakout']
        },
        {
          user: userId,
          symbol: 'TSLA',
          entryPrice: 200,
          quantity: 5,
          direction: 'long',
          result: 'loss',
          profitLoss: -200,
          tags: ['fomo']
        },
        {
          user: userId,
          symbol: 'NVDA',
          entryPrice: 500,
          quantity: 2,
          direction: 'long',
          result: 'win',
          profitLoss: 300,
          tags: ['support']
        }
      ]);
    });

    test('should calculate overall statistics', async () => {
      const response = await request(app)
        .get('/api/trades/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overall.totalTrades).toBe(3);
      expect(response.body.overall.winningTrades).toBe(2);
      expect(response.body.overall.losingTrades).toBe(1);
      expect(response.body.overall.totalProfitLoss).toBe(600);
    });

    test('should calculate statistics by tag', async () => {
      const response = await request(app)
        .get('/api/trades/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.byTag).toBeDefined();
      expect(Array.isArray(response.body.byTag)).toBe(true);
      
      const breakoutStats = response.body.byTag.find(t => t.tag === 'breakout');
      expect(breakoutStats).toBeDefined();
      expect(breakoutStats.total).toBe(1);
      expect(breakoutStats.wins).toBe(1);
      expect(breakoutStats.winRate).toBe(100);
    });
  });

  describe('PATCH /api/trades/:id', () => {
    
    let tradeId;

    beforeEach(async () => {
      const trade = await Trade.create({
        user: userId,
        symbol: 'AAPL',
        entryPrice: 150,
        quantity: 10,
        direction: 'long',
        reason: 'Good setup'
      });
      tradeId = trade._id;
    });

    test('should update trade successfully', async () => {
      const response = await request(app)
        .patch(`/api/trades/${tradeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exitPrice: 155,
          exitReason: 'Hit target',
          result: 'win',
          profitLoss: 500
        })
        .expect(200);

      expect(response.body.exitPrice).toBe(155);
      expect(response.body.result).toBe('win');
      expect(response.body).toHaveProperty('postTradeAnalysis');
    }, 35000);

    test('should not update another user\'s trade', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'SecurePass123!',
          name: 'Other User'
        });

      const otherToken = otherUserResponse.body.token;

      await request(app)
        .patch(`/api/trades/${tradeId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          exitPrice: 155
        })
        .expect(404);
    });

    test('should require authentication', async () => {
      await request(app)
        .patch(`/api/trades/${tradeId}`)
        .send({
          exitPrice: 155
        })
        .expect(401);
    });
  });

  describe('DELETE /api/trades/:id', () => {
    
    let tradeId;

    beforeEach(async () => {
      const trade = await Trade.create({
        user: userId,
        symbol: 'AAPL',
        entryPrice: 150,
        quantity: 10,
        direction: 'long'
      });
      tradeId = trade._id;
    });

    test('should delete trade successfully', async () => {
      await request(app)
        .delete(`/api/trades/${tradeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const trade = await Trade.findById(tradeId);
      expect(trade).toBeNull();
    });

    test('should not delete another user\'s trade', async () => {
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other2@example.com',
          password: 'SecurePass123!',
          name: 'Other User 2'
        });

      const otherToken = otherUserResponse.body.token;

      await request(app)
        .delete(`/api/trades/${tradeId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });
});
