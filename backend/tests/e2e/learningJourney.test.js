const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../backend/server');
const User = require('../../backend/models/User');
const Trade = require('../../backend/models/Trade');

describe('E2E: Learning Journey from Mistakes', () => {
  
  let authToken;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'learninguser@example.com',
        password: 'SecurePass123!',
        name: 'Learning User'
      });

    authToken = response.body.token;
    userId = response.body.user._id;
  });

  afterAll(async () => {
    await Trade.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Trader Makes Mistakes and Learns', () => {
    
    test('Phase 1: Trader makes emotional mistakes', async () => {
      // Create several losing trades with emotional patterns
      const emotionalTrades = [
        {
          symbol: 'AAPL',
          entryPrice: 150,
          exitPrice: 145,
          quantity: 10,
          direction: 'long',
          reason: 'FOMO - afraid to miss the rally, everyone is buying',
          exitReason: 'Panic sold when it dropped, felt anxious',
          result: 'loss',
          profitLoss: -500,
          postTradeReview: {
            mistakes: 'Entered with fear, moved stop-loss away when it went against me',
            planFollowed: 'No, completely ignored my plan',
            lessons: 'Never trade when feeling FOMO or anxious'
          }
        },
        {
          symbol: 'TSLA',
          entryPrice: 200,
          exitPrice: 190,
          quantity: 5,
          direction: 'long',
          reason: 'Revenge trade after previous loss, wanted to make money back quickly',
          exitReason: 'Hit stop loss, but I had moved it further away',
          result: 'loss',
          profitLoss: -500,
          postTradeReview: {
            mistakes: 'Revenge trading, increased position size, moved stop-loss',
            planFollowed: 'No',
            lessons: 'Never revenge trade, stick to position sizing rules'
          }
        },
        {
          symbol: 'NVDA',
          entryPrice: 500,
          exitPrice: 485,
          quantity: 3,
          direction: 'long',
          reason: 'FOMO again, price running up fast',
          exitReason: 'Panic exit',
          result: 'loss',
          profitLoss: -450,
          postTradeReview: {
            mistakes: 'Same FOMO mistake again, no stop-loss set',
            lessons: 'I need to stop FOMO trading'
          }
        }
      ];

      for (const trade of emotionalTrades) {
        const response = await request(app)
          .post('/api/trades')
          .set('Authorization', `Bearer ${authToken}`)
          .send(trade)
          .expect(201);

        expect(response.body).toHaveProperty('postTradeAnalysis');
        expect(response.body.emotionAnalysis.detected).toBe('negative');
      }
    }, 90000);

    test('Phase 2: System identifies patterns in mistakes', async () => {
      const response = await request(app)
        .get('/api/trades/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overall.losingTrades).toBe(3);
      expect(response.body.overall.totalProfitLoss).toBeLessThan(0);
      
      // Check that FOMO tag appears frequently
      const fomoStats = response.body.byTag.find(t => t.tag === 'fomo');
      expect(fomoStats).toBeDefined();
      expect(fomoStats.total).toBeGreaterThan(1);
    });

    test('Phase 3: Trader gets personalized quiz based on mistakes', async () => {
      const response = await request(app)
        .get('/api/explain/quiz?count=5&difficulty=medium')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.quiz).toBeDefined();
      expect(response.body.basedOnTrades).toBe(3);
      expect(response.body.userContext.primaryWeakness).toBe('negative');
      
      // Quiz should reference their actual mistakes
      const quizText = JSON.stringify(response.body.quiz);
      expect(quizText.toLowerCase()).toMatch(/fomo|fear|emotion/);
    }, 35000);

    test('Phase 4: Trader gets flashcards for their specific issues', async () => {
      const response = await request(app)
        .get('/api/explain/flashcards?count=10&category=all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.flashcards).toBeDefined();
      expect(response.body.basedOnTrades).toBe(3);
      expect(response.body.userContext.topMistake).toContain('Entered with fear');
    }, 35000);

    test('Phase 5: Trader applies lessons and makes better trades', async () => {
      const improvedTrades = [
        {
          symbol: 'MSFT',
          entryPrice: 300,
          exitPrice: 310,
          quantity: 5,
          direction: 'long',
          stopLoss: 295,
          takeProfit: 315,
          reason: 'Clear support level bounce, waited for confirmation, feeling calm',
          exitReason: 'Hit take profit, followed plan',
          result: 'win',
          profitLoss: 500,
          postTradeReview: {
            mistakes: 'None',
            planFollowed: 'Yes, followed plan perfectly',
            stopLossMovement: 'No, respected stop-loss',
            lessons: 'Patience and emotional control work'
          }
        },
        {
          symbol: 'GOOGL',
          entryPrice: 140,
          exitPrice: 145,
          quantity: 7,
          direction: 'long',
          stopLoss: 137,
          takeProfit: 148,
          reason: 'Resistance turned support, good risk-reward, no FOMO',
          exitReason: 'Hit take profit',
          result: 'win',
          profitLoss: 350,
          postTradeReview: {
            mistakes: 'None',
            planFollowed: 'Yes',
            lessons: 'Avoiding FOMO leads to better results'
          }
        }
      ];

      for (const trade of improvedTrades) {
        const response = await request(app)
          .post('/api/trades')
          .set('Authorization', `Bearer ${authToken}`)
          .send(trade)
          .expect(201);

        expect(response.body.emotionAnalysis.detected).not.toBe('negative');
        expect(response.body.result).toBe('win');
      }
    }, 60000);

    test('Phase 6: System shows improvement in weekly insights', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/insights/weekly?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.statistics.totalTrades).toBe(5);
      expect(response.body.statistics.winningTrades).toBe(2);
      expect(response.body.statistics.winRate).toBeGreaterThan(0);
      
      // Should show both negative and positive emotions
      expect(response.body.emotionAnalysis.negative).toBeGreaterThan(0);
      expect(response.body.emotionAnalysis.positive).toBeGreaterThan(0);
    }, 35000);

    test('Phase 7: Updated quiz reflects improvement', async () => {
      const response = await request(app)
        .get('/api/explain/quiz?count=5&difficulty=medium')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.basedOnTrades).toBe(5);
      expect(response.body.userContext.winRate).toBeGreaterThan('0');
      
      // Should now include positive patterns too
      const quizText = JSON.stringify(response.body);
      expect(quizText.toLowerCase()).toMatch(/support|resistance|plan/);
    }, 35000);
  });

  describe('Trader Asks Questions and Gets Explanations', () => {
    
    test('Should explain FOMO after experiencing it', async () => {
      const response = await request(app)
        .post('/api/explain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'What is FOMO in trading and how do I avoid it?',
          context: 'trading'
        })
        .expect(200);

      expect(response.body).toHaveProperty('explanation');
      expect(response.body.explanation.toLowerCase()).toMatch(/fear|missing|out/);
    }, 35000);

    test('Should explain stop-loss after mistakes with it', async () => {
      const response = await request(app)
        .post('/api/explain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Why should I never move my stop-loss?',
          context: 'risk-management'
        })
        .expect(200);

      expect(response.body).toHaveProperty('explanation');
    }, 35000);

    test('Should get term explanation', async () => {
      const response = await request(app)
        .get('/api/explain/term?term=support%20and%20resistance&level=beginner')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('explanation');
    }, 35000);
  });
});
