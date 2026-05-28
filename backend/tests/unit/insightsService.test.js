const { generateWeeklyInsights } = require('../../backend/services/insightsService');
const Trade = require('../../backend/models/Trade');
const axios = require('axios');

jest.mock('../../backend/models/Trade');
jest.mock('axios');

describe('Insights Service', () => {
  
  const mockUserId = '507f1f77bcf86cd799439011';
  const startDate = '2025-01-01';
  const endDate = '2025-01-07';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateWeeklyInsights', () => {
    
    test('should return message when no trades found', async () => {
      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });

      const result = await generateWeeklyInsights(mockUserId, startDate, endDate);
      
      expect(result.message).toContain('No trades found');
      expect(result.period).toEqual({ startDate, endDate });
    });

    test('should calculate basic statistics correctly', async () => {
      const mockTrades = [
        {
          result: 'win',
          profitLoss: 500,
          emotionAnalysis: { detected: 'positive' },
          tags: ['support'],
          tradeDate: new Date('2025-01-02')
        },
        {
          result: 'loss',
          profitLoss: -200,
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo'],
          tradeDate: new Date('2025-01-03')
        },
        {
          result: 'win',
          profitLoss: 300,
          emotionAnalysis: { detected: 'positive' },
          tags: ['breakout'],
          tradeDate: new Date('2025-01-05')
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      // Mock Gemini response
      const mockGeminiResponse = {
        data: {
          candidates: [{
            content: {
              parts: [{
                text: 'Detailed trading insights...'
              }]
            }
          }]
        }
      };

      axios.post.mockResolvedValueOnce(mockGeminiResponse);

      const result = await generateWeeklyInsights(mockUserId, startDate, endDate);
      
      expect(result.statistics.totalTrades).toBe(3);
      expect(result.statistics.winningTrades).toBe(2);
      expect(result.statistics.losingTrades).toBe(1);
      expect(result.statistics.totalProfitLoss).toBe(600);
      expect(result.statistics.avgProfitLoss).toBeCloseTo(200, 0);
      expect(result.statistics.winRate).toBeCloseTo(66.67, 1);
    });

    test('should analyze emotions correctly', async () => {
      const mockTrades = [
        { result: 'loss', emotionAnalysis: { detected: 'negative' }, profitLoss: -100 },
        { result: 'loss', emotionAnalysis: { detected: 'negative' }, profitLoss: -150 },
        { result: 'win', emotionAnalysis: { detected: 'positive' }, profitLoss: 200 }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      axios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{ text: 'Insights...' }]
            }
          }]
        }
      });

      const result = await generateWeeklyInsights(mockUserId, startDate, endDate);
      
      expect(result.emotionAnalysis).toBeDefined();
      expect(result.emotionAnalysis.negative).toBe(2);
      expect(result.emotionAnalysis.positive).toBe(1);
    });

    test('should analyze tags correctly', async () => {
      const mockTrades = [
        { result: 'loss', tags: ['fomo', 'breakout'], profitLoss: -100 },
        { result: 'win', tags: ['support'], profitLoss: 200 },
        { result: 'loss', tags: ['fomo'], profitLoss: -50 }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      axios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{ text: 'Insights...' }]
            }
          }]
        }
      });

      const result = await generateWeeklyInsights(mockUserId, startDate, endDate);
      
      expect(result.tagAnalysis).toBeDefined();
      expect(result.tagAnalysis.fomo).toBe(2);
      expect(result.tagAnalysis.support).toBe(1);
      expect(result.tagAnalysis.breakout).toBe(1);
    });

    test('should send comprehensive data to Gemini', async () => {
      const mockTrades = [
        {
          _id: '1',
          symbol: 'AAPL',
          assetType: 'stock',
          direction: 'long',
          entryPrice: 150,
          exitPrice: 155,
          quantity: 10,
          result: 'win',
          profitLoss: 500,
          emotionAnalysis: { detected: 'positive' },
          tags: ['support'],
          tradeDate: new Date('2025-01-02'),
          reason: 'Good setup',
          exitReason: 'Hit target'
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      axios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{ text: 'AI insights response' }]
            }
          }]
        }
      });

      const result = await generateWeeklyInsights(mockUserId, startDate, endDate);
      
      // Verify Gemini was called with comprehensive data
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('TRADING DATA')
                })
              ])
            })
          ])
        }),
        expect.any(Object)
      );

      expect(result.aiInsights).toBe('AI insights response');
      expect(result.trades).toBeDefined();
      expect(result.trades.length).toBe(1);
    });

    test('should include all trade details in response', async () => {
      const mockTrades = [
        {
          _id: '1',
          symbol: 'TSLA',
          entryPrice: 200,
          exitPrice: 210,
          quantity: 5,
          profitLoss: 500,
          result: 'win',
          emotionAnalysis: { detected: 'positive' },
          tags: ['breakout'],
          tradeDate: new Date()
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      axios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{ text: 'Insights' }]
            }
          }]
        }
      });

      const result = await generateWeeklyInsights(mockUserId, startDate, endDate);
      
      expect(result.trades[0]).toHaveProperty('symbol');
      expect(result.trades[0]).toHaveProperty('profitLoss');
      expect(result.trades[0]).toHaveProperty('emotionAnalysis');
      expect(result.trades[0]).toHaveProperty('profitPercentage');
      expect(result.generatedAt).toBeDefined();
    });

    test('should handle Gemini API errors', async () => {
      const mockTrades = [
        { result: 'win', profitLoss: 100, emotionAnalysis: { detected: 'positive' } }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      axios.post.mockRejectedValueOnce(new Error('Gemini API Error'));

      await expect(generateWeeklyInsights(mockUserId, startDate, endDate))
        .rejects.toThrow('Failed to generate insights');
    });

    test('should calculate profit percentage correctly', async () => {
      const mockTrades = [
        {
          _id: '1',
          symbol: 'AAPL',
          entryPrice: 100,
          exitPrice: 110,
          quantity: 10,
          profitLoss: 100,
          result: 'win',
          emotionAnalysis: { detected: 'positive' },
          tradeDate: new Date()
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      axios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{ text: 'Insights' }]
            }
          }]
        }
      });

      const result = await generateWeeklyInsights(mockUserId, startDate, endDate);
      
      expect(result.trades[0].profitPercentage).toBe('10.00');
    });
  });
});
