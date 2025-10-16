const Trade = require('../models/Trade');
const axios = require('axios');

// Helper function to format trade data for Gemini
function formatTradeForAnalysis(trade) {
  return {
    id: trade._id,
    symbol: trade.symbol,
    assetType: trade.assetType,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    result: trade.result,
    profitLoss: trade.profitLoss,
    profitPercentage: trade.profitLoss && trade.entryPrice && trade.quantity 
      ? ((trade.profitLoss / (trade.entryPrice * trade.quantity)) * 100).toFixed(2)
      : null,
    riskRewardRatio: trade.riskRewardRatio,
    tradeDate: trade.tradeDate,
    entryReason: trade.reason || '',
    exitReason: trade.exitReason || '',
    emotionAnalysis: {
      entry: trade.emotionAnalysis || null,
      exit: trade.exitEmotionAnalysis || null
    },
    tags: trade.tags || [],
    notes: trade.notes || '',
    postTradeReview: trade.postTradeReview || null,
    chartScreenshot: trade.chartScreenshot || null
  };
}

async function generateWeeklyInsights(userId, startDate, endDate) {
  try {
    // Get trades for the specified period
    const trades = await Trade.find({
      user: userId,
      tradeDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ tradeDate: 1 });

    if (trades.length === 0) {
      return {
        message: 'No trades found for the specified period',
        period: { startDate, endDate }
      };
    }

    // Calculate basic statistics
    const stats = {
      totalTrades: trades.length,
      winningTrades: trades.filter(t => t.result === 'win').length,
      losingTrades: trades.filter(t => t.result === 'loss').length,
      breakevenTrades: trades.filter(t => t.result === 'breakeven').length,
      openTrades: trades.filter(t => t.result === 'open').length,
      totalProfitLoss: trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0),
      avgProfitLoss: trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / trades.length,
      bestTrade: Math.max(...trades.map(t => t.profitLoss || 0)),
      worstTrade: Math.min(...trades.map(t => t.profitLoss || 0)),
      winRate: trades.filter(t => t.result === 'win').length / trades.length * 100
    };

    // Analyze emotions in trade reasons
    const emotions = trades.map(t => t.emotionAnalysis?.detected || 'neutral');
    const emotionCounts = emotions.reduce((acc, emotion) => {
      acc[emotion] = (acc[emotion] || 0) + 1;
      return acc;
    }, {});

    // Tag analysis
    const allTags = trades.flatMap(t => t.tags || []);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});

    // Format all trades for Gemini
    const formattedTrades = trades.map(formatTradeForAnalysis);

    // Build comprehensive JSON payload for Gemini
    const analysisPayload = {
      period: {
        startDate,
        endDate,
        durationDays: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
      },
      statistics: stats,
      emotionAnalysis: emotionCounts,
      tagAnalysis: tagCounts,
      trades: formattedTrades
    };

    // Generate AI insights using Google's Generative AI with full trade details
    const prompt = `# ROLE
You are a professional trading performance analyst with 15+ years of experience in technical analysis, risk management, and trader psychology. You specialize in identifying behavioral patterns, emotional biases, and strategic weaknesses that impact trading performance.

# CONTEXT
A trader has completed ${stats.totalTrades} trades over a ${Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))}-day period from ${startDate} to ${endDate}. You have access to comprehensive trade data including entry/exit prices, profit/loss, emotional states during entry/exit, trading strategies used (tags), and the trader's own reasoning for each trade.

Current Performance Snapshot:
- Win Rate: ${stats.winRate.toFixed(2)}%
- Total P/L: ${stats.totalProfitLoss.toFixed(2)}
- Average P/L per Trade: ${stats.avgProfitLoss.toFixed(2)}
- Best Trade: ${stats.bestTrade.toFixed(2)} | Worst Trade: ${stats.worstTrade.toFixed(2)}
- Emotional Distribution: ${JSON.stringify(emotionCounts)}

# TASK
Analyze the complete trading data provided below and generate a comprehensive performance report that:
1. Identifies specific patterns correlating with winning vs losing trades
2. Evaluates the impact of emotional states (confidence, fear, neutral) on trade outcomes
3. Assesses which trading strategies/tags are most and least effective
4. Reviews risk management practices (stop-loss usage, position sizing, risk-reward ratios)
5. Highlights 2-3 exemplary trades and 2-3 problematic trades with specific reasons
6. Provides actionable, prioritized recommendations for immediate improvement

# TRADING DATA (JSON)
${JSON.stringify(analysisPayload, null, 2)}

# CONSTRAINTS
- Base ALL insights on the actual data provided - do not make generic trading advice
- Reference specific trades by symbol and date when making points
- Quantify patterns wherever possible (e.g., "70% of losing trades had 'fear' emotion")
- Focus on behavioral and psychological patterns, not just numerical statistics
- Avoid technical jargon; explain concepts clearly
- Be direct and honest about weaknesses, but constructive in tone
- Limit response to 800-1000 words for readability

# OUTPUT FORMAT
Structure your analysis in the following sections with clear markdown formatting:

## 📊 Performance Overview
[2-3 sentences summarizing overall performance and key metrics]

## 🎯 Winning Trade Patterns
- [List 3-5 specific characteristics common in winning trades]
- [Include: emotions, strategies/tags, symbols, entry/exit reasoning patterns]

## ⚠️ Losing Trade Patterns  
- [List 3-5 specific characteristics common in losing trades]
- [Include: emotions, strategies/tags, symbols, entry/exit reasoning patterns]

## 🧠 Emotional Impact Analysis
- **Confidence Trades**: [Performance when entering with confidence emotion]
- **Fear Trades**: [Performance when entering with fear emotion]
- **Neutral Trades**: [Performance when entering with neutral emotion]
- [Key insight about emotion-outcome correlation]

## 📈 Strategy Effectiveness
[Table or list showing each strategy/tag with its win rate and average P/L]
- Best Performing: [Strategy name] - [Stats]
- Worst Performing: [Strategy name] - [Stats]

## 🛡️ Risk Management Assessment
- Stop Loss Usage: [% of trades with SL, effectiveness]
- Risk-Reward Ratios: [Average R:R, assessment]
- Position Sizing: [Consistency, issues identified]
- [Overall risk management grade: A/B/C/D/F with justification]

## 💡 Trade Highlights

### Exemplary Trades
1. **[Symbol] on [Date]**: [Why this trade was excellent - 1-2 sentences]
2. **[Symbol] on [Date]**: [Why this trade was excellent - 1-2 sentences]

### Problematic Trades
1. **[Symbol] on [Date]**: [What went wrong - 1-2 sentences]
2. **[Symbol] on [Date]**: [What went wrong - 1-2 sentences]

## 🎯 Priority Recommendations
1. **[Highest Priority Action]**: [Specific, actionable step with expected impact]
2. **[Second Priority Action]**: [Specific, actionable step with expected impact]
3. **[Third Priority Action]**: [Specific, actionable step with expected impact]
4. **[Fourth Priority Action]**: [Specific, actionable step with expected impact]
5. **[Fifth Priority Action]**: [Specific, actionable step with expected impact]

## 📝 Final Thoughts
[2-3 sentences with encouragement and the single most important takeaway]

---
Generate the analysis now.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout for larger payloads
      }
    );

    const aiInsights = response.data.candidates[0].content.parts[0].text;

    return {
      period: { startDate, endDate },
      statistics: stats,
      emotionAnalysis: emotionCounts,
      tagAnalysis: tagCounts,
      tradesAnalyzed: formattedTrades.length,
      trades: formattedTrades, // Include all trade details in response
      aiInsights,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating insights:', error);
    throw new Error('Failed to generate insights');
  }
}

module.exports = {
  generateWeeklyInsights
};