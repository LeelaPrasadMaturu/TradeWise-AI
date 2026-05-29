const Trade = require('../models/Trade');
const axios = require('axios');
const cache = require('./cacheService');

/**
 * Analyzes user's trading history to identify patterns, mistakes, and learning opportunities
 */
async function analyzeUserTradingPatterns(userId, lookbackDays = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);

  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate }
  }).sort({ tradeDate: -1 }).limit(7);

  if (trades.length === 0) {
    return null;
  }

  const losingTrades = trades.filter(t => t.result === 'loss');
  const winningTrades = trades.filter(t => t.result === 'win');

  const compactTrades = trades.map(t => ({
    sym: t.symbol,
    d: t.direction,
    pl: t.profitLoss,
    r: t.result,
    em: t.emotionAnalysis?.detected || null,
    tags: t.tags?.slice(0, 3) || [],
    noSL: !t.stopLoss,
    noTP: !t.takeProfit
  }));

  const patterns = {
    compactTrades,
    emotionInLosses: losingTrades.map(t => t.emotionAnalysis?.detected).filter(Boolean),
    emotionInWins: winningTrades.map(t => t.emotionAnalysis?.detected).filter(Boolean),
    tagsInLosses: losingTrades.flatMap(t => t.tags || []),
    tagsInWins: winningTrades.flatMap(t => t.tags || []),
    commonMistakes: losingTrades.map(t => t.postTradeReview?.mistakes).filter(Boolean),
    tradesWithoutStopLoss: trades.filter(t => !t.stopLoss).length,
    tradesWithoutTakeProfit: trades.filter(t => !t.takeProfit).length,
    disciplineIssues: {
      movedSLDown: trades.filter(t => t.movedStopLossDown).length,
      earlyExits: trades.filter(t => t.earlyExit?.exitedBeforeTarget).length,
    },
    winRate: winningTrades.length / trades.length * 100,
    avgProfitLoss: trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / trades.length,
    worstTrade: losingTrades.sort((a, b) => (a.profitLoss || 0) - (b.profitLoss || 0))[0]
      ? { sym: losingTrades[0].symbol, loss: losingTrades[0].profitLoss }
      : null,
    bestTrade: winningTrades.sort((a, b) => (b.profitLoss || 0) - (a.profitLoss || 0))[0]
      ? { sym: winningTrades[0].symbol, profit: winningTrades[0].profitLoss }
      : null,
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
      trades: patterns.compactTrades,
      stats: {
        winRate: patterns.winRate.toFixed(2),
        avgPL: patterns.avgProfitLoss.toFixed(2),
        missingSL: patterns.tradesWithoutStopLoss,
        missingTP: patterns.tradesWithoutTakeProfit,
        slMoved: patterns.disciplineIssues.movedSLDown,
        earlyExits: patterns.disciplineIssues.earlyExits
      },
      patterns: {
        lossEmotions: getMostCommon(patterns.emotionInLosses).slice(0, 3),
        winEmotions: getMostCommon(patterns.emotionInWins).slice(0, 3),
        lossTags: getMostCommon(patterns.tagsInLosses).slice(0, 3),
        winTags: getMostCommon(patterns.tagsInWins).slice(0, 3),
        mistakes: patterns.commonMistakes.slice(0, 3)
      },
      highlights: {
        worstTrade: patterns.worstTrade,
        bestTrade: patterns.bestTrade
      }
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

    const cacheKey = cache.generateKey('quiz:generate', userId, JSON.stringify(options));

    return await cache.wrap(cacheKey, async () => {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
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
          timeout: 60000
        }
      );

      const aiResponse = response.data.candidates[0].content.parts[0].text;

      const quizData = JSON.parse(sanitizeJSON(aiResponse));
      const answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

      return {
        quiz: {
          questions: (quizData.quiz || []).map(q => ({
            id: q.id,
            question: q.question,
            options: q.options || [],
            correctAnswer: answerMap[q.correctAnswer] ?? q.correctAnswer,
            explanation: q.explanation || '',
            relatedPattern: q.category || '',
            difficulty: q.difficulty
          })),
          difficulty,
          generatedAt: new Date().toISOString()
        },
        summary: quizData.summary || {}
      };
    });

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
      trades: patterns.compactTrades,
      stats: {
        winRate: patterns.winRate.toFixed(2),
        avgPL: patterns.avgProfitLoss.toFixed(2),
        missingSL: patterns.tradesWithoutStopLoss,
        missingTP: patterns.tradesWithoutTakeProfit,
        slMoved: patterns.disciplineIssues.movedSLDown,
        earlyExits: patterns.disciplineIssues.earlyExits
      },
      patterns: {
        lossEmotions: getMostCommon(patterns.emotionInLosses),
        winEmotions: getMostCommon(patterns.emotionInWins),
        lossTags: getMostCommon(patterns.tagsInLosses),
        winTags: getMostCommon(patterns.tagsInWins),
        mistakes: patterns.commonMistakes.slice(0, 5)
      },
      highlights: {
        worstTrade: patterns.worstTrade,
        bestTrade: patterns.bestTrade
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

    const cacheKey = cache.generateKey('flashcard:generate', userId, JSON.stringify(options));

    return await cache.wrap(cacheKey, async () => {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
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
          timeout: 60000
        }
      );

      const aiResponse = response.data.candidates[0].content.parts[0].text;

      const flashcardData = JSON.parse(sanitizeJSON(aiResponse));
      const cards = flashcardData.flashcards || [];
      const categories = [...new Set(cards.map(c => c.category).filter(Boolean))];

      return {
        flashcards: cards.map(c => ({
          id: c.id,
          front: c.front,
          back: c.back,
          category: c.category || 'general',
          difficulty: c.priority || 'medium'
        })),
        categories,
        generatedAt: new Date().toISOString()
      };
    });

  } catch (error) {
    console.error('Error generating personalized flashcards:', error);
    throw new Error('Failed to generate personalized flashcards');
  }
}

/**
 * Clean malformed JSON from LLM responses
 */
function sanitizeJSON(text) {
  let json = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  const braceMatch = json.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (braceMatch) json = braceMatch[0];
  json = json.replace(/,\s*([}\]])/g, '$1');
  return json;
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
