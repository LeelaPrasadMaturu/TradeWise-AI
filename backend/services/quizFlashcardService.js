const Trade = require('../models/Trade');
const axios = require('axios');

/**
 * Analyzes user's trading history to identify patterns, mistakes, and learning opportunities
 */
async function analyzeUserTradingPatterns(userId, lookbackDays = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);

  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate }
  }).sort({ tradeDate: -1 });

  if (trades.length === 0) {
    return null;
  }

  // Analyze losing trades for common mistakes
  const losingTrades = trades.filter(t => t.result === 'loss');
  const winningTrades = trades.filter(t => t.result === 'win');

  // Extract patterns
  const patterns = {
    // Emotion patterns
    emotionInLosses: losingTrades.map(t => t.emotionAnalysis?.detected).filter(Boolean),
    emotionInWins: winningTrades.map(t => t.emotionAnalysis?.detected).filter(Boolean),
    
    // Tag patterns
    tagsInLosses: losingTrades.flatMap(t => t.tags || []),
    tagsInWins: winningTrades.flatMap(t => t.tags || []),
    
    // Common mistakes from post-trade reviews
    commonMistakes: losingTrades
      .map(t => t.postTradeReview?.mistakes)
      .filter(Boolean),
    
    // Lessons learned
    lessonsLearned: trades
      .map(t => t.postTradeReview?.lessons)
      .filter(Boolean),
    
    // AI insights from post-trade analysis
    aiRecommendations: trades
      .filter(t => t.postTradeAnalysis?.recommendations)
      .flatMap(t => t.postTradeAnalysis.recommendations),
    
    // Risk management issues
    tradesWithoutStopLoss: trades.filter(t => !t.stopLoss).length,
    tradesWithoutTakeProfit: trades.filter(t => !t.takeProfit).length,
    
    // Performance metrics
    winRate: winningTrades.length / trades.length * 100,
    avgProfitLoss: trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / trades.length,
    
    // Specific problematic trades
    worstTrades: losingTrades
      .sort((a, b) => (a.profitLoss || 0) - (b.profitLoss || 0))
      .slice(0, 3)
      .map(t => ({
        symbol: t.symbol,
        date: t.tradeDate,
        loss: t.profitLoss,
        reason: t.reason,
        exitReason: t.exitReason,
        emotion: t.emotionAnalysis?.detected,
        tags: t.tags,
        mistakes: t.postTradeReview?.mistakes
      })),
    
    // Best trades for positive reinforcement
    bestTrades: winningTrades
      .sort((a, b) => (b.profitLoss || 0) - (a.profitLoss || 0))
      .slice(0, 3)
      .map(t => ({
        symbol: t.symbol,
        date: t.tradeDate,
        profit: t.profitLoss,
        reason: t.reason,
        emotion: t.emotionAnalysis?.detected,
        tags: t.tags
      }))
  };

  return patterns;
}

/**
 * Generates personalized quiz based on user's trading mistakes and patterns
 */
async function generatePersonalizedQuiz(userId, options = {}) {
  const {
    count = 5,
    difficulty = 'medium',
    focusAreas = [] // e.g., ['emotions', 'risk-management', 'strategy']
  } = options;

  try {
    // Analyze user's trading patterns
    const patterns = await analyzeUserTradingPatterns(userId);

    if (!patterns) {
      return {
        message: 'Not enough trading data to generate personalized quiz',
        quiz: []
      };
    }

    // Build context for Gemini
    const quizContext = {
      userStats: {
        totalTrades: patterns.emotionInLosses.length + patterns.emotionInWins.length,
        winRate: patterns.winRate.toFixed(2),
        avgProfitLoss: patterns.avgProfitLoss.toFixed(2)
      },
      weaknesses: {
        emotionalPatterns: getMostCommon(patterns.emotionInLosses),
        problematicTags: getMostCommon(patterns.tagsInLosses),
        commonMistakes: patterns.commonMistakes.slice(0, 5),
        riskManagementIssues: {
          missingStopLoss: patterns.tradesWithoutStopLoss,
          missingTakeProfit: patterns.tradesWithoutTakeProfit
        }
      },
      strengths: {
        successfulEmotions: getMostCommon(patterns.emotionInWins),
        successfulTags: getMostCommon(patterns.tagsInWins)
      },
      worstTrades: patterns.worstTrades,
      aiInsights: patterns.aiRecommendations.slice(0, 5)
    };

    // Generate quiz using Gemini
    const prompt = `# ROLE
You are an expert trading educator specializing in personalized learning based on individual trader performance data.

# CONTEXT
A trader needs a personalized quiz to learn from their actual trading mistakes and improve their decision-making. You have access to their complete trading history analysis.

# TRADER'S PERFORMANCE DATA
${JSON.stringify(quizContext, null, 2)}

# TASK
Generate ${count} multiple-choice quiz questions (difficulty: ${difficulty}) that:
1. Address their SPECIFIC mistakes and weaknesses (not generic trading questions)
2. Reference their actual trading patterns (emotions, tags, mistakes)
3. Include scenarios similar to their worst trades
4. Reinforce lessons from their AI-generated insights
5. Test understanding of risk management gaps they've shown
6. Help them recognize emotional patterns that led to losses

# CONSTRAINTS
- Each question MUST be based on their actual data above
- Reference specific emotions, tags, or mistakes they've made
- Make questions practical and actionable
- Difficulty levels:
  * easy: Recognition and recall of their patterns
  * medium: Application to new scenarios
  * hard: Analysis and synthesis of multiple patterns
- Include 4 options per question (A, B, C, D)
- Provide detailed explanations that reference their actual trades

# OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code blocks):

{
  "quiz": [
    {
      "id": 1,
      "question": "Based on your trading history, you've lost money 70% of the time when entering trades with 'fear' emotion. In which scenario should you AVOID taking a trade?",
      "options": [
        "A) Strong breakout with high volume, feeling confident",
        "B) Price dropping fast, afraid to miss the bottom, feeling anxious",
        "C) Clear support level hold, neutral emotion",
        "D) Bullish divergence on RSI, feeling prepared"
      ],
      "correctAnswer": "B",
      "explanation": "Your data shows that trades entered with fear/anxiety emotion resulted in 70% losses. Option B describes a fear-driven scenario (FOMO, anxiety) similar to your past losing trades. You should wait for emotional clarity before entering.",
      "category": "emotional-awareness",
      "personalizedInsight": "In your worst trade on [symbol], you entered with fear emotion and lost [amount]. Recognizing this pattern is crucial.",
      "difficulty": "${difficulty}",
      "learningObjective": "Recognize and avoid fear-based trading entries"
    }
  ],
  "summary": {
    "focusAreas": ["List of main areas this quiz addresses"],
    "personalizedMessage": "Brief message about what they'll learn"
  }
}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const aiResponse = response.data.candidates[0].content.parts[0].text;
    
    // Parse JSON response (remove markdown code blocks if present)
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const quizData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiResponse);

    return {
      ...quizData,
      generatedAt: new Date().toISOString(),
      basedOnTrades: patterns.emotionInLosses.length + patterns.emotionInWins.length,
      userContext: {
        winRate: patterns.winRate.toFixed(2),
        primaryWeakness: getMostCommon(patterns.emotionInLosses)[0] || 'Unknown'
      }
    };

  } catch (error) {
    console.error('Error generating personalized quiz:', error);
    throw new Error('Failed to generate personalized quiz');
  }
}

/**
 * Generates personalized flashcards based on user's mistakes and insights
 */
async function generatePersonalizedFlashcards(userId, options = {}) {
  const {
    count = 10,
    category = 'all' // 'emotions', 'mistakes', 'strategies', 'risk-management', 'all'
  } = options;

  try {
    // Analyze user's trading patterns
    const patterns = await analyzeUserTradingPatterns(userId);

    if (!patterns) {
      return {
        message: 'Not enough trading data to generate personalized flashcards',
        flashcards: []
      };
    }

    // Build context for Gemini
    const flashcardContext = {
      userStats: {
        totalTrades: patterns.emotionInLosses.length + patterns.emotionInWins.length,
        winRate: patterns.winRate.toFixed(2)
      },
      keyLearningAreas: {
        emotionalPatterns: {
          lossEmotions: getMostCommon(patterns.emotionInLosses),
          winEmotions: getMostCommon(patterns.emotionInWins)
        },
        commonMistakes: patterns.commonMistakes.slice(0, 10),
        lessonsLearned: patterns.lessonsLearned.slice(0, 10),
        aiRecommendations: patterns.aiRecommendations.slice(0, 10),
        problematicStrategies: getMostCommon(patterns.tagsInLosses),
        successfulStrategies: getMostCommon(patterns.tagsInWins),
        riskManagementGaps: {
          missingStopLoss: patterns.tradesWithoutStopLoss,
          missingTakeProfit: patterns.tradesWithoutTakeProfit
        }
      },
      specificExamples: {
        worstTrades: patterns.worstTrades,
        bestTrades: patterns.bestTrades
      }
    };

    const prompt = `# ROLE
You are a trading psychology and education expert creating personalized learning flashcards.

# CONTEXT
A trader needs flashcards to internalize lessons from their actual trading mistakes, emotional patterns, and AI-generated insights. These flashcards will help them make better decisions in real-time.

# TRADER'S LEARNING DATA
${JSON.stringify(flashcardContext, null, 2)}

# TASK
Generate ${count} flashcards (category: ${category}) that:
1. Turn their specific mistakes into memorable lessons
2. Address their emotional patterns (what emotions led to losses vs wins)
3. Reinforce AI-generated recommendations they received
4. Create mental models for avoiding past mistakes
5. Include real examples from their trading history
6. Focus on actionable, practical knowledge they can use before entering trades

# CONSTRAINTS
- Each flashcard MUST be based on their actual data
- Front: A question, scenario, or concept they need to remember
- Back: Clear answer with specific reference to their trading patterns
- Include category tags: emotional-awareness, risk-management, strategy-execution, mistake-prevention, etc.
- Make them practical for quick review before trading sessions
- Reference their actual trades when relevant (e.g., "Remember your AAPL trade where...")
- Priority order: Common mistakes > Emotional patterns > AI insights > Risk management

# OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code blocks):

{
  "flashcards": [
    {
      "id": 1,
      "front": "What emotion led to 70% of your losing trades?",
      "back": "Fear/Anxiety. Your data shows that when you entered trades feeling fearful or anxious (often FOMO), you lost 70% of the time. Before entering, check: Am I feeling anxious or afraid to miss out?",
      "category": "emotional-awareness",
      "priority": "high",
      "realExample": "Your worst trade: [Symbol] on [Date] - entered with fear, lost [amount]",
      "actionableReminder": "Wait 5 minutes when feeling anxious. If fear persists, skip the trade.",
      "relatedConcepts": ["FOMO", "emotional trading", "patience"]
    },
    {
      "id": 2,
      "front": "What's your #1 most common mistake according to your post-trade reviews?",
      "back": "[Specific mistake from their data, e.g., 'Moving stop-loss further away when trade goes against me']. You've identified this in 5 of your losing trades. This turns small losses into big losses.",
      "category": "mistake-prevention",
      "priority": "critical",
      "realExample": "Trades where this happened: [List specific symbols/dates]",
      "actionableReminder": "Set stop-loss and DO NOT TOUCH IT. Use alerts instead of manual monitoring.",
      "relatedConcepts": ["discipline", "risk management", "stop-loss"]
    }
  ],
  "summary": {
    "totalFlashcards": ${count},
    "categories": ["List of categories covered"],
    "studyRecommendation": "Review these flashcards before each trading session. Focus on high-priority cards first.",
    "personalizedMessage": "These flashcards are based on your actual trading patterns from [X] trades."
  }
}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const aiResponse = response.data.candidates[0].content.parts[0].text;
    
    // Parse JSON response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const flashcardData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiResponse);

    return {
      ...flashcardData,
      generatedAt: new Date().toISOString(),
      basedOnTrades: patterns.emotionInLosses.length + patterns.emotionInWins.length,
      userContext: {
        winRate: patterns.winRate.toFixed(2),
        primaryWeakness: getMostCommon(patterns.emotionInLosses)[0] || 'Unknown',
        topMistake: patterns.commonMistakes[0] || 'Not enough data'
      }
    };

  } catch (error) {
    console.error('Error generating personalized flashcards:', error);
    throw new Error('Failed to generate personalized flashcards');
  }
}

/**
 * Helper function to get most common items from array
 */
function getMostCommon(arr) {
  if (!arr || arr.length === 0) return [];
  
  const counts = arr.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count, percentage: (count / arr.length * 100).toFixed(1) }));
}

module.exports = {
  generatePersonalizedQuiz,
  generatePersonalizedFlashcards,
  analyzeUserTradingPatterns
};
