/**
 * Time-in-Trade Alert Service
 * Monitors open trades and alerts when they exceed average hold time
 * Helps traders who "hold losers too long"
 */

const Trade = require('../models/Trade');
const UserBaseline = require('../models/UserBaseline');

/**
 * Get open trades that have exceeded average hold time
 */
async function getOverheldTrades(userId) {
  const baseline = await UserBaseline.findOne({ user: userId });
  
  if (!baseline || !baseline.avgHoldDurationMinutes || baseline.avgHoldDurationMinutes === 0) {
    return { alerts: [], message: 'Not enough trade history to calculate average hold time' };
  }
  
  const avgHoldMinutes = baseline.avgHoldDurationMinutes;
  const tradingStyle = baseline.tradingStyle || 'INTRADAY';
  
  // Get style-specific multiplier for alert threshold
  const styleMultipliers = {
    'SCALPER': 1.5,      // Alert at 1.5x avg hold
    'INTRADAY': 2.0,     // Alert at 2x avg hold
    'SWING': 1.5,        // Alert at 1.5x avg hold
    'POSITIONAL': 1.3,   // Alert at 1.3x avg hold
    'UNKNOWN': 2.0
  };
  
  const multiplier = styleMultipliers[tradingStyle] || 2.0;
  const alertThresholdMinutes = avgHoldMinutes * multiplier;
  
  // Get all open trades
  const openTrades = await Trade.find({
    user: userId,
    result: 'open'
  }).sort({ entryTime: 1 });
  
  const now = new Date();
  const alerts = [];
  
  for (const trade of openTrades) {
    const entryTime = new Date(trade.entryTime || trade.tradeDate);
    const holdMinutes = (now - entryTime) / (1000 * 60);
    
    if (holdMinutes > alertThresholdMinutes) {
      // Calculate unrealized P&L if we have current price approximation
      const unrealizedPnL = trade.exitPrice 
        ? (trade.exitPrice - trade.entryPrice) * trade.quantity * (trade.direction === 'long' ? 1 : -1)
        : null;
      
      const severity = holdMinutes > alertThresholdMinutes * 2 ? 'critical' 
        : holdMinutes > alertThresholdMinutes * 1.5 ? 'high' 
        : 'warning';
      
      alerts.push({
        tradeId: trade._id,
        symbol: trade.symbol,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        entryTime: trade.entryTime,
        holdMinutes: Math.round(holdMinutes),
        avgHoldMinutes: Math.round(avgHoldMinutes),
        exceedsByMinutes: Math.round(holdMinutes - alertThresholdMinutes),
        exceedsByPercent: Math.round(((holdMinutes / avgHoldMinutes) - 1) * 100),
        severity,
        unrealizedPnL,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        message: buildAlertMessage(trade, holdMinutes, avgHoldMinutes, severity)
      });
    }
  }
  
  // Sort by severity (critical first) then by hold time
  alerts.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, warning: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.holdMinutes - a.holdMinutes;
  });
  
  return {
    alerts,
    tradingStyle,
    avgHoldMinutes: Math.round(avgHoldMinutes),
    alertThresholdMinutes: Math.round(alertThresholdMinutes),
    totalOpenTrades: openTrades.length,
    overheldCount: alerts.length
  };
}

/**
 * Build human-readable alert message
 */
function buildAlertMessage(trade, holdMinutes, avgHoldMinutes, severity) {
  const formatDuration = (mins) => {
    if (mins < 60) return `${Math.round(mins)} min`;
    if (mins < 1440) return `${(mins / 60).toFixed(1)} hrs`;
    return `${(mins / 1440).toFixed(1)} days`;
  };
  
  const holdStr = formatDuration(holdMinutes);
  const avgStr = formatDuration(avgHoldMinutes);
  const ratio = (holdMinutes / avgHoldMinutes).toFixed(1);
  
  if (severity === 'critical') {
    return `CRITICAL: ${trade.symbol} held for ${holdStr} (${ratio}x your avg of ${avgStr}). Consider immediate action.`;
  } else if (severity === 'high') {
    return `${trade.symbol} significantly overheld: ${holdStr} vs avg ${avgStr}. Review your exit plan.`;
  }
  return `${trade.symbol} exceeding typical hold time: ${holdStr} vs avg ${avgStr}. Monitor closely.`;
}

/**
 * Get hold time statistics by result (winners vs losers)
 */
async function getHoldTimeAnalysis(userId, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const trades = await Trade.find({
    user: userId,
    result: { $in: ['win', 'loss'] },
    entryTime: { $exists: true },
    exitTime: { $exists: true },
    tradeDate: { $gte: startDate }
  }).lean();
  
  if (trades.length < 5) {
    return { message: 'Not enough closed trades for analysis' };
  }
  
  const winners = trades.filter(t => t.result === 'win');
  const losers = trades.filter(t => t.result === 'loss');
  
  const calcStats = (tradeList) => {
    if (tradeList.length === 0) return null;
    
    const holdTimes = tradeList.map(t => 
      (new Date(t.exitTime) - new Date(t.entryTime)) / (1000 * 60)
    );
    
    const sorted = [...holdTimes].sort((a, b) => a - b);
    const avg = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    return {
      count: tradeList.length,
      avgMinutes: Math.round(avg),
      medianMinutes: Math.round(median),
      minMinutes: Math.round(min),
      maxMinutes: Math.round(max)
    };
  };
  
  const winnerStats = calcStats(winners);
  const loserStats = calcStats(losers);
  
  // Calculate loss aversion ratio (how much longer losers are held vs winners)
  let lossAversionRatio = null;
  let lossAversionMessage = null;
  
  if (winnerStats && loserStats && winnerStats.avgMinutes > 0) {
    lossAversionRatio = loserStats.avgMinutes / winnerStats.avgMinutes;
    
    if (lossAversionRatio > 2) {
      lossAversionMessage = `You hold losers ${lossAversionRatio.toFixed(1)}x longer than winners. This is a significant loss aversion pattern.`;
    } else if (lossAversionRatio > 1.5) {
      lossAversionMessage = `You hold losers ${lossAversionRatio.toFixed(1)}x longer than winners. Consider tightening stop losses.`;
    } else if (lossAversionRatio > 1) {
      lossAversionMessage = `Slightly longer holds on losers (${lossAversionRatio.toFixed(1)}x). Room for improvement.`;
    } else {
      lossAversionMessage = `Good discipline! You cut losers faster than winners (ratio: ${lossAversionRatio.toFixed(2)}).`;
    }
  }
  
  return {
    periodDays: days,
    totalTrades: trades.length,
    winners: winnerStats,
    losers: loserStats,
    lossAversionRatio: lossAversionRatio ? Math.round(lossAversionRatio * 100) / 100 : null,
    lossAversionMessage,
    recommendation: lossAversionRatio > 1.5 
      ? 'Consider setting time-based exit rules or tighter stop losses to reduce hold time on losing trades.'
      : 'Your hold time management is healthy. Keep it up!'
  };
}

/**
 * Check if a specific trade is being overheld (for real-time alerts)
 */
async function checkTradeHoldTime(userId, tradeId) {
  const [trade, baseline] = await Promise.all([
    Trade.findOne({ _id: tradeId, user: userId }),
    UserBaseline.findOne({ user: userId })
  ]);
  
  if (!trade || trade.result !== 'open') {
    return { isOverheld: false, message: 'Trade not found or already closed' };
  }
  
  if (!baseline || !baseline.avgHoldDurationMinutes) {
    return { isOverheld: false, message: 'No baseline data available' };
  }
  
  const now = new Date();
  const entryTime = new Date(trade.entryTime || trade.tradeDate);
  const holdMinutes = (now - entryTime) / (1000 * 60);
  const avgHold = baseline.avgHoldDurationMinutes;
  
  const isOverheld = holdMinutes > avgHold * 1.5;
  const percentOver = ((holdMinutes / avgHold) - 1) * 100;
  
  return {
    isOverheld,
    holdMinutes: Math.round(holdMinutes),
    avgHoldMinutes: Math.round(avgHold),
    percentOver: Math.round(percentOver),
    message: isOverheld 
      ? `Trade has been held ${Math.round(percentOver)}% longer than your average`
      : `Trade is within normal hold time range`
  };
}

module.exports = {
  getOverheldTrades,
  getHoldTimeAnalysis,
  checkTradeHoldTime
};
