const axios = require('axios');

// Build a compact, structured payload for LLM consumption
function buildPostTradePayload(trade) {
  return {
    tradeMeta: {
      id: String(trade._id),
      userId: String(trade.user),
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt
    },
    core: {
      symbol: trade.symbol,
      assetType: trade.assetType,
      direction: trade.direction,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      tradeDate: trade.tradeDate,
      result: trade.result,
      profitLoss: trade.profitLoss
    },
    reasoning: {
      entryReason: trade.reason || '',
      exitReason: trade.exitReason || ''
    },
    emotions: {
      entry: trade.emotionAnalysis || null,
      exit: trade.exitEmotionAnalysis || null
    },
    tags: trade.tags || [],
    notes: trade.notes || '',
    review: trade.postTradeReview || {},
    derived: {
      riskRewardRatio: trade.riskRewardRatio || null
    }
  };
}

// Call Google Gemini with the full JSON payload for narrative analysis
async function analyzeWithGemini(payload) {
  const prompt = `You are a trading performance coach. Analyze the following trade JSON. Return a concise summary, key mistakes, what went well, and 3-5 actionable recommendations. Keep responses practical. JSON follows:\n\n${JSON.stringify(payload)}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

async function generatePostTradeAnalysis(trade) {
  const payload = buildPostTradePayload(trade);
  const narrative = await analyzeWithGemini(payload);

  // Attempt to extract simple lists using naive parsing; keep robust by returning narrative
  const recommendations = [];
  const risksObserved = [];

  return {
    generatedAt: new Date(),
    model: 'gemini-2.0-flash',
    summary: narrative,
    recommendations,
    risksObserved,
    structured: payload
  };
}

module.exports = {
  buildPostTradePayload,
  generatePostTradeAnalysis
};


