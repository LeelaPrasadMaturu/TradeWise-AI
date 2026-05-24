const { analyzeEmotion, extractTagsFromReason } = require('../../backend/services/emotionDetectService');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('Emotion Detection Service', () => {
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractTagsFromReason', () => {
    
    test('should extract breakout tag from reason', () => {
      const reason = 'Strong breakout above resistance with high volume';
      const tags = extractTagsFromReason(reason);
      
      expect(tags).toContain('breakout');
      expect(tags).toContain('resistance');
      expect(tags).toContain('volume');
    });

    test('should extract support tag', () => {
      const reason = 'Price bounced off support level';
      const tags = extractTagsFromReason(reason);
      
      expect(tags).toContain('support');
    });

    test('should detect FOMO patterns', () => {
      const reason = 'FOMO trade, afraid to miss out on the rally';
      const tags = extractTagsFromReason(reason);
      
      expect(tags).toContain('fomo');
    });

    test('should detect revenge trading', () => {
      const reason = 'Revenge trade after previous loss';
      const tags = extractTagsFromReason(reason);
      
      expect(tags).toContain('revenge-trade');
    });

    test('should detect multiple patterns', () => {
      const reason = 'Breakout with strong momentum and high volume';
      const tags = extractTagsFromReason(reason);
      
      expect(tags.length).toBeGreaterThan(1);
      expect(tags).toContain('breakout');
      expect(tags).toContain('momentum');
      expect(tags).toContain('volume');
    });

    test('should return empty array for generic reason', () => {
      const reason = 'Just felt like trading';
      const tags = extractTagsFromReason(reason);
      
      expect(Array.isArray(tags)).toBe(true);
    });

    test('should handle empty string', () => {
      const tags = extractTagsFromReason('');
      
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBe(0);
    });

    test('should be case insensitive', () => {
      const reason = 'BREAKOUT ABOVE RESISTANCE';
      const tags = extractTagsFromReason(reason);
      
      expect(tags).toContain('breakout');
      expect(tags).toContain('resistance');
    });
  });

  describe('analyzeEmotion', () => {
    
    test('should return positive emotion from FinBERT API', async () => {
      // Mock successful FinBERT response
      axios.post.mockResolvedValueOnce({
        data: [{
          label: 'positive',
          score: 0.95
        }]
      });

      const result = await analyzeEmotion('Excellent setup with strong bullish momentum');
      
      expect(result.detected).toBe('positive');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.source).toBe('finbert');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('huggingface'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('should return negative emotion from FinBERT API', async () => {
      axios.post.mockResolvedValueOnce({
        data: [{
          label: 'negative',
          score: 0.88
        }]
      });

      const result = await analyzeEmotion('Panic selling, market crashing');
      
      expect(result.detected).toBe('negative');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.source).toBe('finbert');
    });

    test('should return neutral emotion from FinBERT API', async () => {
      axios.post.mockResolvedValueOnce({
        data: [{
          label: 'neutral',
          score: 0.75
        }]
      });

      const result = await analyzeEmotion('Standard trade setup');
      
      expect(result.detected).toBe('neutral');
      expect(result.source).toBe('finbert');
    });

    test('should fallback to keyword detection when API fails', async () => {
      // Mock API failure
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeEmotion('Bullish breakout with strong momentum');
      
      expect(result.detected).toBe('positive');
      expect(result.source).toBe('keyword');
      expect(result.confidence).toBeDefined();
    });

    test('should detect positive keywords in fallback', async () => {
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeEmotion('Confident about this trade, strong setup');
      
      expect(result.detected).toBe('positive');
      expect(result.source).toBe('keyword');
    });

    test('should detect negative keywords in fallback', async () => {
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeEmotion('Fear of missing out, anxious about this trade');
      
      expect(result.detected).toBe('negative');
      expect(result.source).toBe('keyword');
    });

    test('should default to neutral when no keywords match', async () => {
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeEmotion('Regular trade entry');
      
      expect(result.detected).toBe('neutral');
      expect(result.source).toBe('keyword');
    });

    test('should handle empty text', async () => {
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeEmotion('');
      
      expect(result.detected).toBe('neutral');
      expect(result.source).toBe('keyword');
    });

    test('should include emotion type in response', async () => {
      axios.post.mockResolvedValueOnce({
        data: [{
          label: 'positive',
          score: 0.92
        }]
      });

      const result = await analyzeEmotion('Confident trade with good risk-reward');
      
      expect(result.emotionType).toBeDefined();
    });
  });
});
