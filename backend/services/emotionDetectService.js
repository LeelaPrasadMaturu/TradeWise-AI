const axios = require('axios');
const constants = require('../config/constants');

// Map of FinBERT sentiments to schema-valid values
// detected: must be 'positive', 'negative', or 'neutral'
// emotionType: can be specific emotions like 'confidence', 'fear', 'fomo'
const sentimentToEmotionType = {
  'positive': 'confidence',
  'negative': 'fear',
  'neutral': 'neutral'
};

// Trading-specific keyword-based emotion detection as fallback
// Returns detected as 'positive', 'negative', or 'neutral' (schema-valid)
// Returns emotionType as specific emotion like 'confidence', 'fear', 'fomo'
const detectEmotionFromKeywords = (text) => {
  const keywords = {
    positive: ['bullish', 'breakout', 'trend', 'momentum', 'support', 'resistance', 'accumulation', 'strong', 'opportunity', 'potential'],
    negative: ['bearish', 'breakdown', 'reversal', 'weak', 'sell', 'risk', 'uncertain', 'volatile', 'fomo', 'miss out', 'late', 'rushing', 'hurry', 'anxious'],
    neutral: ['consolidation', 'range', 'sideways', 'wait', 'observe', 'monitor', 'plan', 'strategy']
  };

  const lowerText = text.toLowerCase();
  
  // Check for FOMO-specific patterns
  if (lowerText.includes('fomo') || 
      lowerText.includes('miss out') || 
      lowerText.includes('late') || 
      lowerText.includes('rushing') || 
      lowerText.includes('hurry') ||
      lowerText.includes('anxious')) {
    return {
      detected: 'negative',
      confidence: 0.8,
      source: 'keyword',
      emotionType: 'fomo'
    };
  }

  for (const [sentiment, words] of Object.entries(keywords)) {
    if (words.some(word => lowerText.includes(word))) {
      return {
        detected: sentiment,
        confidence: 0.7,
        source: 'keyword',
        emotionType: sentimentToEmotionType[sentiment]
      };
    }
  }

  return {
    detected: 'neutral',
    confidence: 0.5,
    source: 'keyword',
    emotionType: 'neutral'
  };
};

// Function to extract tags from trade reason
function extractTagsFromReason(reason) {
  const lowerReason = reason.toLowerCase();
  const extractedTags = new Set();

  // Trading strategy tags
  const strategyKeywords = {
    'breakout': ['breakout', 'break out', 'breaking out'],
    'breakdown': ['breakdown', 'break down', 'breaking down'],
    'support': ['support', 'support level', 'support zone'],
    'resistance': ['resistance', 'resistance level', 'resistance zone'],
    'trend': ['trend', 'trending', 'trend line'],
    'momentum': ['momentum', 'momentum indicator'],
    'reversal': ['reversal', 'reversing', 'reversed'],
    'consolidation': ['consolidation', 'consolidating', 'range', 'sideways'],
    'fomo': ['fomo', 'miss out', 'late', 'rushing', 'hurry', 'anxious'],
    'scalp': ['scalp', 'scalping', 'quick trade'],
    'swing': ['swing', 'swing trade', 'swing trading'],
    'position': ['position', 'position trade', 'position trading'],
    'day': ['day trade', 'day trading', 'intraday'],
    'gap': ['gap', 'gap up', 'gap down'],
    'news': ['news', 'announcement', 'earnings', 'report'],
    'technical': ['technical', 'technical analysis', 'chart pattern'],
    'fundamental': ['fundamental', 'fundamentals', 'financials'],
    'volume': ['volume', 'vol', 'volume profile'],
    'divergence': ['divergence', 'diverging', 'diverged'],
    'retracement': ['retracement', 'retrace', 'pullback']
  };

  // Check for each strategy keyword
  for (const [tag, keywords] of Object.entries(strategyKeywords)) {
    if (keywords.some(keyword => lowerReason.includes(keyword))) {
      extractedTags.add(tag);
    }
  }

  // Add emotion-based tags (use emotionType for more specific tags)
  const emotionAnalysis = detectEmotionFromKeywords(reason);
  if (emotionAnalysis.emotionType && emotionAnalysis.emotionType !== 'neutral') {
    extractedTags.add(emotionAnalysis.emotionType);
  }

  return Array.from(extractedTags);
}

async function analyzeEmotion(text) {
  try {
    // Check if Hugging Face API key is available
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.warn('HUGGINGFACE_API_KEY not found, using keyword-based detection');
      return detectEmotionFromKeywords(text);
    }

    // Use the FinBERT model via Hugging Face API
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${constants.AI_SERVICES.HUGGINGFACE.MODEL}`,
      { inputs: text },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      }
    );

    // FinBERT returns an array of sentiment scores
    const result = response.data;
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('Invalid response format from FinBERT');
    }

    // Get the highest confidence sentiment
    const sentiments = result[0];
    const topSentiment = Object.entries(sentiments).reduce((a, b) => a[1] > b[1] ? a : b);
    
    // Check for FOMO indicators in the text
    const lowerText = text.toLowerCase();
    const isFOMO = lowerText.includes('fomo') || 
                   lowerText.includes('miss out') || 
                   lowerText.includes('late') || 
                   lowerText.includes('rushing') || 
                   lowerText.includes('hurry') ||
                   lowerText.includes('anxious');
    
    // Ensure confidence is a valid number between 0 and 1
    const confidence = parseFloat(topSentiment[1]);
    const validConfidence = isNaN(confidence) ? 0.5 : Math.max(0, Math.min(1, confidence));
    
    // FinBERT returns 'positive', 'negative', or 'neutral' which are valid enum values
    const detectedSentiment = ['positive', 'negative', 'neutral'].includes(topSentiment[0]) 
      ? topSentiment[0] 
      : 'neutral';
    
    return {
      detected: detectedSentiment,
      confidence: validConfidence,
      source: 'finbert',
      rawSentiment: topSentiment[0],
      emotionType: isFOMO ? 'fomo' : sentimentToEmotionType[detectedSentiment]
    };
  } catch (error) {
    console.error('Error in emotion detection:', error.message);
    
    // If it's a permission error, log it specifically
    if (error.response?.status === 403) {
      console.error('Hugging Face API permission error. Please check your API key permissions.');
    }
    
    // Fallback to keyword-based detection
    return detectEmotionFromKeywords(text);
  }
}

module.exports = {
  analyzeEmotion,
  extractTagsFromReason
}; 