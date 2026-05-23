const axios = require('axios');
const Trade = require('../models/Trade');
const UserBaseline = require('../models/UserBaseline');

// Check for immediate behavioral patterns on this specific trade
async function checkImmediateBehavioralPatterns(trade) {
  const warnings = [];
  
  try {
    const baseline = await UserBaseline.findOne({ user: trade.user });
    if (!baseline || baseline.basedOnTradeCount < 5) {
      return warnings; // Not enough data for pattern detection
    }
    
    // Get recent trades for context
    const recentTrades = await Trade.find({
      user: trade.user,
      _id: { $ne: trade._id },
      tradeDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ entryTime: -1, tradeDate: -1 }).limit(10);
    
    if (recentTrades.length === 0) return warnings;
    
    const lastTrade = recentTrades[0];
    const currentPositionValue = trade.positionValue || (trade.entryPrice * trade.quantity);
    const lastPositionValue = lastTrade.positionValue || (lastTrade.entryPrice * lastTrade.quantity);
    
    // 1. Check for Revenge Trading
    if (lastTrade.result === 'loss') {
      const timeSinceLoss = (new Date(trade.entryTime || trade.tradeDate) - 
        new Date(lastTrade.exitTime || lastTrade.tradeDate)) / (1000 * 60);
      const styleConfig = baseline.getStyleConfig();
      
      if (timeSinceLoss <= styleConfig.revengeWindowMinutes && timeSinceLoss >= 0) {
        const sizeIncrease = lastPositionValue > 0 ? 
          (currentPositionValue - lastPositionValue) / lastPositionValue : 0;
        
        if (sizeIncrease >= styleConfig.sizeDeviationThreshold) {
          warnings.push({
            type: 'REVENGE_TRADING_WARNING',
            severity: 'high',
            message: `This trade was entered ${Math.round(timeSinceLoss)} minutes after a loss with ${(sizeIncrease * 100).toFixed(0)}% larger position. Historical data shows your win rate drops significantly in these situations.`,
            recommendation: `Consider waiting at least ${styleConfig.revengeWindowMinutes} minutes after a loss before trading.`
          });
        }
      }
    }
    
    // 2. Check for Tilt (multiple recent losses)
    const recentResults = recentTrades.slice(0, 4).map(t => t.result);
    const recentLosses = recentResults.filter(r => r === 'loss').length;
    if (recentLosses >= 3) {
      warnings.push({
        type: 'TILT_WARNING',
        severity: 'medium',
        message: `You've had ${recentLosses} losses in your last ${recentTrades.slice(0, 4).length} trades. Consider taking a break.`,
        recommendation: 'Step away for 30-60 minutes to reset emotionally before continuing.'
      });
    }
    
    // 3. Check for Overconfidence (large size after wins)
    const recentWins = recentTrades.slice(0, 3).filter(t => t.result === 'win').length;
    if (recentWins >= 3 && baseline.avgPositionSize > 0) {
      const sizeDeviation = (currentPositionValue - baseline.avgPositionSize) / baseline.avgPositionSize;
      if (sizeDeviation > 0.5) {
        warnings.push({
          type: 'OVERCONFIDENCE_WARNING',
          severity: 'medium',
          message: `After ${recentWins} consecutive wins, your position size is ${(sizeDeviation * 100).toFixed(0)}% above your average. Overconfidence after wins often leads to outsized losses.`,
          recommendation: 'Stick to your normal position sizing regardless of recent results.'
        });
      }
    }
    
    // 4. Check for trading during worst performing hours
    if (baseline.worstPerformingHours && baseline.worstPerformingHours.length > 0) {
      const tradeHour = new Date(trade.entryTime || trade.tradeDate).getHours();
      if (baseline.worstPerformingHours.includes(tradeHour)) {
        const hourPerf = baseline.hourlyPerformance?.find(h => h.hour === tradeHour);
        if (hourPerf && hourPerf.winRate < baseline.baselineWinRate - 15) {
          warnings.push({
            type: 'TIME_OF_DAY_WARNING',
            severity: 'low',
            message: `Trading at ${tradeHour}:00 - your win rate this hour is ${hourPerf.winRate.toFixed(0)}% vs ${baseline.baselineWinRate.toFixed(0)}% baseline.`,
            recommendation: `Consider avoiding trades between ${tradeHour}:00-${tradeHour + 1}:00.`
          });
        }
      }
    }
    
    // 5. Check for negative emotion entry
    if (trade.emotionAnalysis?.detected === 'negative') {
      warnings.push({
        type: 'NEGATIVE_EMOTION_WARNING',
        severity: 'medium',
        message: 'Negative emotion detected in your trade reason. Your data shows lower win rates when trading with fear/anxiety.',
        recommendation: 'Wait for emotional neutrality before entering trades.'
      });
    }
    
  } catch (err) {
    console.error('Behavioral pattern check error (non-fatal):', err.message);
  }
  
  return warnings;
}

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
async function analyzeWithGemini(payload, warningsContext = '') {
  const prompt = `You are a trading performance coach. Analyze the following trade JSON. Return a concise summary, key mistakes, what went well, and 3-5 actionable recommendations. Keep responses practical.${warningsContext}\n\nJSON follows:\n\n${JSON.stringify(payload)}`;

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
  
  // Check for immediate behavioral patterns
  const behavioralWarnings = await checkImmediateBehavioralPatterns(trade);
  
  // Include behavioral warnings in the prompt if any
  let warningsContext = '';
  if (behavioralWarnings.length > 0) {
    warningsContext = `\n\nBEHAVIORAL PATTERN WARNINGS DETECTED:\n${behavioralWarnings.map(w => 
      `- ${w.type}: ${w.message}`
    ).join('\n')}\n\nAddress these patterns in your analysis.`;
  }
  
  const narrative = await analyzeWithGemini(payload, warningsContext);

  // Extract recommendations from warnings
  const recommendations = behavioralWarnings
    .filter(w => w.recommendation)
    .map(w => w.recommendation);
  
  // Extract risks from high/medium severity warnings
  const risksObserved = behavioralWarnings
    .filter(w => w.severity === 'high' || w.severity === 'medium')
    .map(w => w.message);

  return {
    generatedAt: new Date(),
    model: 'gemini-2.0-flash',
    summary: narrative,
    recommendations,
    risksObserved,
    behavioralWarnings,
    structured: payload
  };
}

module.exports = {
  buildPostTradePayload,
  generatePostTradeAnalysis,
  checkImmediateBehavioralPatterns
};


