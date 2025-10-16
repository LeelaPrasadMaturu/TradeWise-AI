const { 
  analyzeUserTradingPatterns,
  generatePersonalizedQuiz,
  generatePersonalizedFlashcards 
} = require('../../backend/services/quizFlashcardService');
const Trade = require('../../backend/models/Trade');
const axios = require('axios');

// Mock dependencies
jest.mock('../../backend/models/Trade');
jest.mock('axios');

describe('Quiz and Flashcard Service', () => {
  
  const mockUserId = '507f1f77bcf86cd799439011';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeUserTradingPatterns', () => {
    
    test('should return null when no trades found', async () => {
      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });

      const result = await analyzeUserTradingPatterns(mockUserId);
      
      expect(result).toBeNull();
      expect(Trade.find).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUserId,
          tradeDate: expect.any(Object)
        })
      );
    });

    test('should analyze patterns from user trades', async () => {
      const mockTrades = [
        {
          result: 'loss',
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo', 'breakout'],
          profitLoss: -100,
          postTradeReview: { mistakes: 'Moved stop-loss' }
        },
        {
          result: 'win',
          emotionAnalysis: { detected: 'positive' },
          tags: ['support'],
          profitLoss: 200,
          postTradeReview: { lessons: 'Followed plan' }
        },
        {
          result: 'loss',
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo'],
          profitLoss: -150
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      const result = await analyzeUserTradingPatterns(mockUserId);
      
      expect(result).toBeDefined();
      expect(result.emotionInLosses).toHaveLength(2);
      expect(result.emotionInWins).toHaveLength(1);
      expect(result.tagsInLosses).toContain('fomo');
      expect(result.commonMistakes).toContain('Moved stop-loss');
      expect(result.winRate).toBeCloseTo(33.33, 1);
    });

    test('should identify worst trades', async () => {
      const mockTrades = [
        {
          result: 'loss',
          profitLoss: -500,
          symbol: 'AAPL',
          tradeDate: new Date(),
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo']
        },
        {
          result: 'loss',
          profitLoss: -200,
          symbol: 'TSLA',
          tradeDate: new Date(),
          emotionAnalysis: { detected: 'negative' },
          tags: ['revenge-trade']
        },
        {
          result: 'win',
          profitLoss: 300,
          symbol: 'NVDA',
          tradeDate: new Date(),
          emotionAnalysis: { detected: 'positive' },
          tags: ['support']
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      const result = await analyzeUserTradingPatterns(mockUserId);
      
      expect(result.worstTrades).toBeDefined();
      expect(result.worstTrades[0].symbol).toBe('AAPL');
      expect(result.worstTrades[0].loss).toBe(-500);
    });

    test('should identify best trades', async () => {
      const mockTrades = [
        {
          result: 'win',
          profitLoss: 500,
          symbol: 'NVDA',
          tradeDate: new Date(),
          emotionAnalysis: { detected: 'positive' },
          tags: ['support']
        },
        {
          result: 'win',
          profitLoss: 300,
          symbol: 'MSFT',
          tradeDate: new Date(),
          emotionAnalysis: { detected: 'positive' },
          tags: ['trend-following']
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      const result = await analyzeUserTradingPatterns(mockUserId);
      
      expect(result.bestTrades).toBeDefined();
      expect(result.bestTrades[0].symbol).toBe('NVDA');
      expect(result.bestTrades[0].profit).toBe(500);
    });

    test('should count trades without stop-loss', async () => {
      const mockTrades = [
        { result: 'loss', stopLoss: null, profitLoss: -100 },
        { result: 'win', stopLoss: 145, profitLoss: 200 },
        { result: 'loss', stopLoss: null, profitLoss: -50 }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      const result = await analyzeUserTradingPatterns(mockUserId);
      
      expect(result.tradesWithoutStopLoss).toBe(2);
    });
  });

  describe('generatePersonalizedQuiz', () => {
    
    test('should return message when insufficient data', async () => {
      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });

      const result = await generatePersonalizedQuiz(mockUserId);
      
      expect(result.message).toContain('Not enough trading data');
      expect(result.quiz).toEqual([]);
    });

    test('should generate quiz from trading patterns', async () => {
      const mockTrades = [
        {
          result: 'loss',
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo'],
          profitLoss: -100,
          postTradeReview: { mistakes: 'Entered with fear' }
        },
        {
          result: 'win',
          emotionAnalysis: { detected: 'positive' },
          tags: ['support'],
          profitLoss: 200
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      // Mock Gemini API response
      const mockQuizResponse = {
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  quiz: [
                    {
                      id: 1,
                      question: 'Based on your history, when should you avoid trading?',
                      options: ['A) When confident', 'B) When fearful', 'C) When neutral', 'D) Always trade'],
                      correctAnswer: 'B',
                      explanation: 'Your data shows losses when trading with fear',
                      category: 'emotional-awareness',
                      difficulty: 'medium'
                    }
                  ],
                  summary: {
                    focusAreas: ['emotional-awareness'],
                    personalizedMessage: 'Focus on emotional control'
                  }
                })
              }]
            }
          }]
        }
      };

      axios.post.mockResolvedValueOnce(mockQuizResponse);

      const result = await generatePersonalizedQuiz(mockUserId, { count: 5, difficulty: 'medium' });
      
      expect(result.quiz).toBeDefined();
      expect(result.quiz.length).toBeGreaterThan(0);
      expect(result.generatedAt).toBeDefined();
      expect(result.basedOnTrades).toBe(2);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('should handle Gemini API errors gracefully', async () => {
      const mockTrades = [
        { result: 'loss', emotionAnalysis: { detected: 'negative' }, profitLoss: -100 }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      axios.post.mockRejectedValueOnce(new Error('API Error'));

      await expect(generatePersonalizedQuiz(mockUserId)).rejects.toThrow('Failed to generate personalized quiz');
    });
  });

  describe('generatePersonalizedFlashcards', () => {
    
    test('should return message when insufficient data', async () => {
      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });

      const result = await generatePersonalizedFlashcards(mockUserId);
      
      expect(result.message).toContain('Not enough trading data');
      expect(result.flashcards).toEqual([]);
    });

    test('should generate flashcards from trading patterns', async () => {
      const mockTrades = [
        {
          result: 'loss',
          emotionAnalysis: { detected: 'negative' },
          tags: ['fomo'],
          profitLoss: -100,
          postTradeReview: { 
            mistakes: 'Moved stop-loss',
            lessons: 'Never move stop-loss'
          },
          postTradeAnalysis: {
            recommendations: ['Avoid FOMO trades', 'Set stop-loss and respect it']
          }
        }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      const mockFlashcardResponse = {
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  flashcards: [
                    {
                      id: 1,
                      front: 'What emotion led to most of your losses?',
                      back: 'Fear/Anxiety - 70% of losses',
                      category: 'emotional-awareness',
                      priority: 'high',
                      actionableReminder: 'Wait 5 minutes when feeling anxious'
                    }
                  ],
                  summary: {
                    totalFlashcards: 10,
                    categories: ['emotional-awareness', 'risk-management'],
                    studyRecommendation: 'Review before each trading session'
                  }
                })
              }]
            }
          }]
        }
      };

      axios.post.mockResolvedValueOnce(mockFlashcardResponse);

      const result = await generatePersonalizedFlashcards(mockUserId, { count: 10 });
      
      expect(result.flashcards).toBeDefined();
      expect(result.flashcards.length).toBeGreaterThan(0);
      expect(result.generatedAt).toBeDefined();
      expect(result.basedOnTrades).toBe(1);
    });

    test('should handle different categories', async () => {
      const mockTrades = [
        { result: 'loss', emotionAnalysis: { detected: 'negative' }, profitLoss: -100 }
      ];

      Trade.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTrades)
      });

      const mockResponse = {
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  flashcards: [],
                  summary: {}
                })
              }]
            }
          }]
        }
      };

      axios.post.mockResolvedValueOnce(mockResponse);

      await generatePersonalizedFlashcards(mockUserId, { category: 'emotions', count: 5 });
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('category: emotions')
                })
              ])
            })
          ])
        }),
        expect.any(Object)
      );
    });
  });
});
