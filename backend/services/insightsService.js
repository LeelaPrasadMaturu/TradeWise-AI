const Trade = require('../models/Trade');
const axios = require('axios');

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
      totalProfitLoss: trades.reduce((sum, t) => sum + t.profitLoss, 0),
      avgProfitLoss: trades.reduce((sum, t) => sum + t.profitLoss, 0) / trades.length,
      bestTrade: Math.max(...trades.map(t => t.profitLoss)),
      worstTrade: Math.min(...trades.map(t => t.profitLoss))
    };

    // Analyze emotions in trade reasons
    const emotions = trades.map(t => t.emotionAnalysis?.detected || 'neutral');
    const emotionCounts = emotions.reduce((acc, emotion) => {
      acc[emotion] = (acc[emotion] || 0) + 1;
      return acc;
    }, {});

    // Generate AI insights using Google's Generative AI
    const prompt = `Analyze these trading statistics and provide insights:
    Total Trades: ${stats.totalTrades}
    Win Rate: ${((stats.winningTrades / stats.totalTrades) * 100).toFixed(2)}%
    Total P/L: ${stats.totalProfitLoss}
    Average P/L: ${stats.avgProfitLoss.toFixed(2)}
    Best Trade: ${stats.bestTrade}
    Worst Trade: ${stats.worstTrade}
    Emotion Distribution: ${JSON.stringify(emotionCounts)}
    
    Provide 3-4 key insights and 2-3 recommendations for improvement.`;

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
        }
      }
    );

    const aiInsights = response.data.candidates[0].content.parts[0].text;

    return {
      period: { startDate, endDate },
      statistics: stats,
      emotionAnalysis: emotionCounts,
      aiInsights
    };
  } catch (error) {
    console.error('Error generating insights:', error);
    throw new Error('Failed to generate insights');
  }
}

module.exports = {
  generateWeeklyInsights
}; 