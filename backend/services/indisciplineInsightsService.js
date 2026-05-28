/**
 * Indiscipline Insights Service
 * Analyzes stop-loss movements and early exits to provide behavioral insights
 */

const Trade = require('../models/Trade');

/**
 * Analyze stop-loss movement patterns for a user
 */
async function analyzeStopLossMovements(userId, periodDays = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate },
    result: { $in: ['win', 'loss', 'breakeven'] }
  }).sort({ tradeDate: -1 });

  const totalTrades = trades.length;
  const tradesWithSL = trades.filter(t => t.stopLoss);
  const tradesMovedSL = trades.filter(t => t.movedStopLoss);
  const tradesMovedSLDown = trades.filter(t => t.movedStopLossDown);

  // Calculate outcomes for trades where SL was moved down
  const slDownOutcomes = tradesMovedSLDown.map(trade => {
    const extraRisk = trade.originalStopLoss && trade.stopLoss
      ? Math.abs(trade.originalStopLoss - trade.stopLoss) * trade.quantity
      : 0;
    
    return {
      tradeId: trade._id,
      symbol: trade.symbol,
      date: trade.tradeDate,
      result: trade.result,
      profitLoss: trade.profitLoss || 0,
      extraRisk,
      reason: trade.stopLossMovementReason,
      originalSL: trade.originalStopLoss,
      finalSL: trade.stopLoss,
      exitPrice: trade.exitPrice
    };
  });

  // Losses when SL was moved down
  const lossesFromMovedSL = slDownOutcomes.filter(t => t.result === 'loss');
  const totalExtraLoss = lossesFromMovedSL.reduce((sum, t) => {
    if (t.originalSL && t.exitPrice) {
      const wouldHaveLost = Math.abs(t.originalSL - t.exitPrice) > 0;
      if (wouldHaveLost && t.profitLoss < 0) {
        return sum + t.extraRisk;
      }
    }
    return sum;
  }, 0);

  // Win rate comparison
  const normalTrades = trades.filter(t => !t.movedStopLossDown && t.stopLoss);
  const normalWinRate = normalTrades.length > 0
    ? (normalTrades.filter(t => t.result === 'win').length / normalTrades.length) * 100
    : 0;

  const movedSLDownWinRate = tradesMovedSLDown.length > 0
    ? (tradesMovedSLDown.filter(t => t.result === 'win').length / tradesMovedSLDown.length) * 100
    : 0;

  // Common reasons for moving SL
  const slMovementReasons = {};
  tradesMovedSLDown.forEach(t => {
    if (t.stopLossMovementReason) {
      const reason = t.stopLossMovementReason.toLowerCase();
      slMovementReasons[reason] = (slMovementReasons[reason] || 0) + 1;
    }
  });

  const sortedReasons = Object.entries(slMovementReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  // Trades that would have survived with original SL
  const wouldHaveSurvived = lossesFromMovedSL.filter(t => {
    if (!t.originalSL || !t.exitPrice) return false;
    // Check if the trade hit the widened SL but not the original
    // This is simplified - in real scenario we'd need intraday data
    return Math.abs(t.exitPrice - t.finalSL) < Math.abs(t.exitPrice - t.originalSL);
  });

  return {
    periodDays,
    summary: {
      totalTrades,
      tradesWithStopLoss: tradesWithSL.length,
      stopLossUsageRate: totalTrades > 0 
        ? Math.round((tradesWithSL.length / totalTrades) * 100) 
        : 0,
      tradesMovedStopLoss: tradesMovedSL.length,
      tradesMovedStopLossDown: tradesMovedSLDown.length,
      percentMovedDown: tradesWithSL.length > 0
        ? Math.round((tradesMovedSLDown.length / tradesWithSL.length) * 100)
        : 0
    },
    impact: {
      lossesFromMovedSL: lossesFromMovedSL.length,
      totalExtraLoss: Math.round(totalExtraLoss),
      averageExtraLoss: lossesFromMovedSL.length > 0
        ? Math.round(totalExtraLoss / lossesFromMovedSL.length)
        : 0,
      potentialSavings: Math.round(totalExtraLoss)
    },
    winRateComparison: {
      normalWinRate: Math.round(normalWinRate),
      movedSLDownWinRate: Math.round(movedSLDownWinRate),
      difference: Math.round(normalWinRate - movedSLDownWinRate),
      insight: normalWinRate > movedSLDownWinRate + 10
        ? 'Moving SL down significantly hurts your win rate'
        : normalWinRate > movedSLDownWinRate
        ? 'Moving SL down slightly reduces your win rate'
        : 'Insufficient data to determine impact'
    },
    commonReasons: sortedReasons,
    recentExamples: slDownOutcomes.slice(0, 5),
    recommendations: generateSLRecommendations(tradesMovedSLDown.length, totalExtraLoss, normalWinRate, movedSLDownWinRate)
  };
}

/**
 * Analyze early exit patterns for a user
 */
async function analyzeEarlyExits(userId, periodDays = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate },
    result: { $in: ['win', 'loss', 'breakeven'] },
    takeProfit: { $exists: true, $ne: null }
  }).sort({ tradeDate: -1 });

  const totalTrades = trades.length;
  const earlyExitTrades = trades.filter(t => t.earlyExit?.exitedBeforeTarget);
  const profitableEarlyExits = earlyExitTrades.filter(t => t.result === 'win');

  // Calculate missed profits
  const missedProfitData = profitableEarlyExits.map(trade => {
    const actualProfit = trade.profitLoss || 0;
    const potentialProfit = trade.direction === 'long'
      ? (trade.takeProfit - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - trade.takeProfit) * trade.quantity;
    const missedProfit = potentialProfit - actualProfit;
    const percentAchieved = trade.earlyExit?.percentToTarget || 
      (actualProfit / potentialProfit * 100);

    return {
      tradeId: trade._id,
      symbol: trade.symbol,
      date: trade.tradeDate,
      actualProfit,
      potentialProfit,
      missedProfit: missedProfit > 0 ? missedProfit : 0,
      percentAchieved: Math.round(percentAchieved),
      exitReason: trade.earlyExit?.exitReason,
      targetHitAfterExit: trade.earlyExit?.targetHitAfterExit
    };
  });

  const totalMissedProfit = missedProfitData.reduce((sum, t) => sum + t.missedProfit, 0);
  const avgPercentAchieved = missedProfitData.length > 0
    ? missedProfitData.reduce((sum, t) => sum + t.percentAchieved, 0) / missedProfitData.length
    : 0;

  // Exit reasons breakdown
  const exitReasons = {};
  earlyExitTrades.forEach(t => {
    const reason = t.earlyExit?.exitReason || 'unspecified';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
  });

  const sortedExitReasons = Object.entries(exitReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ 
      reason, 
      count,
      label: getEarlyExitReasonLabel(reason)
    }));

  // Compare full target vs early exit trades
  const fullTargetTrades = trades.filter(t => {
    if (!t.takeProfit || !t.exitPrice) return false;
    const isLong = t.direction === 'long';
    return isLong 
      ? t.exitPrice >= t.takeProfit 
      : t.exitPrice <= t.takeProfit;
  });

  const fullTargetAvgProfit = fullTargetTrades.length > 0
    ? fullTargetTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / fullTargetTrades.length
    : 0;

  const earlyExitAvgProfit = profitableEarlyExits.length > 0
    ? profitableEarlyExits.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / profitableEarlyExits.length
    : 0;

  return {
    periodDays,
    summary: {
      totalTradesWithTarget: totalTrades,
      earlyExitCount: earlyExitTrades.length,
      profitableEarlyExits: profitableEarlyExits.length,
      earlyExitRate: totalTrades > 0
        ? Math.round((earlyExitTrades.length / totalTrades) * 100)
        : 0,
      avgPercentToTarget: Math.round(avgPercentAchieved)
    },
    impact: {
      totalMissedProfit: Math.round(totalMissedProfit),
      avgMissedPerTrade: missedProfitData.length > 0
        ? Math.round(totalMissedProfit / missedProfitData.length)
        : 0,
      potentialExtraProfit: Math.round(totalMissedProfit)
    },
    profitComparison: {
      fullTargetAvgProfit: Math.round(fullTargetAvgProfit),
      earlyExitAvgProfit: Math.round(earlyExitAvgProfit),
      difference: Math.round(fullTargetAvgProfit - earlyExitAvgProfit),
      insight: fullTargetAvgProfit > earlyExitAvgProfit * 1.5
        ? 'Holding to target significantly increases your profits'
        : fullTargetAvgProfit > earlyExitAvgProfit
        ? 'Holding to target generally improves your results'
        : 'Early exits may be working for your style'
    },
    exitReasons: sortedExitReasons,
    recentExamples: missedProfitData.slice(0, 5),
    recommendations: generateEarlyExitRecommendations(
      earlyExitTrades.length, 
      totalMissedProfit, 
      sortedExitReasons, 
      avgPercentAchieved
    )
  };
}

/**
 * Get combined indiscipline analysis
 */
async function getIndisciplineAnalysis(userId, periodDays = 90) {
  const [slAnalysis, earlyExitAnalysis] = await Promise.all([
    analyzeStopLossMovements(userId, periodDays),
    analyzeEarlyExits(userId, periodDays)
  ]);

  const totalCost = slAnalysis.impact.totalExtraLoss + earlyExitAnalysis.impact.totalMissedProfit;

  return {
    periodDays,
    stopLossMovements: slAnalysis,
    earlyExits: earlyExitAnalysis,
    combinedImpact: {
      totalIndisciplineCost: Math.round(totalCost),
      breakdownText: `SL widening cost: ₹${slAnalysis.impact.totalExtraLoss} | Early exits missed: ₹${earlyExitAnalysis.impact.totalMissedProfit}`,
      primaryIssue: slAnalysis.impact.totalExtraLoss > earlyExitAnalysis.impact.totalMissedProfit
        ? 'Stop-loss management needs focus'
        : 'Exit timing needs improvement'
    },
    topRecommendations: [
      ...slAnalysis.recommendations.slice(0, 2),
      ...earlyExitAnalysis.recommendations.slice(0, 2)
    ]
  };
}

/**
 * Generate SL movement recommendations
 */
function generateSLRecommendations(movedCount, extraLoss, normalWinRate, movedWinRate) {
  const recommendations = [];

  if (movedCount > 5) {
    recommendations.push({
      priority: 'high',
      type: 'behavioral',
      message: `You moved your stop loss down in ${movedCount} trades. This added approximately ₹${extraLoss} in extra losses.`,
      action: 'Set a rule to never move SL away from entry. Use the trade form reminder.'
    });
  }

  if (normalWinRate - movedWinRate > 15) {
    recommendations.push({
      priority: 'high',
      type: 'statistical',
      message: `Your win rate drops from ${normalWinRate}% to ${movedWinRate}% when you move SL down.`,
      action: 'Moving SL down is costing you trades. Trust your original analysis.'
    });
  }

  if (extraLoss > 5000) {
    recommendations.push({
      priority: 'high',
      type: 'financial',
      message: `Moving SL down has cost you approximately ₹${extraLoss} in extra losses.`,
      action: 'That money could have been saved with original stop losses.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'info',
      type: 'positive',
      message: 'Your stop-loss discipline looks reasonable.',
      action: 'Keep following your risk management rules.'
    });
  }

  return recommendations;
}

/**
 * Generate early exit recommendations
 */
function generateEarlyExitRecommendations(earlyExitCount, missedProfit, reasons, avgPercent) {
  const recommendations = [];

  if (earlyExitCount > 10 && avgPercent < 70) {
    recommendations.push({
      priority: 'high',
      type: 'behavioral',
      message: `You exited ${earlyExitCount} trades before target, capturing only ${Math.round(avgPercent)}% of potential profit on average.`,
      action: 'Practice holding winners longer. Set alerts at target levels instead of watching constantly.'
    });
  }

  const fearCount = reasons.find(r => r.reason === 'fear')?.count || 0;
  if (fearCount > 3) {
    recommendations.push({
      priority: 'high',
      type: 'emotional',
      message: `Fear caused you to exit ${fearCount} trades early.`,
      action: 'When you feel fear in a winning trade, step away from the screen. Let your stop loss protect you.'
    });
  }

  const impatienceCount = reasons.find(r => r.reason === 'impatience')?.count || 0;
  if (impatienceCount > 3) {
    recommendations.push({
      priority: 'medium',
      type: 'behavioral',
      message: `Impatience caused ${impatienceCount} early exits.`,
      action: 'Set a timer before making exit decisions. Give trades time to work.'
    });
  }

  if (missedProfit > 10000) {
    recommendations.push({
      priority: 'high',
      type: 'financial',
      message: `Early exits cost you approximately ₹${missedProfit} in missed profits.`,
      action: 'That could have been additional profit with patience.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'info',
      type: 'positive',
      message: 'Your exit timing is reasonable.',
      action: 'Continue letting winners run to target.'
    });
  }

  return recommendations;
}

/**
 * Get human-readable label for early exit reason
 */
function getEarlyExitReasonLabel(reason) {
  const labels = {
    fear: 'Fear of losing profit',
    impatience: 'Impatience',
    news: 'News/External event',
    time_constraint: 'Time constraint',
    changed_view: 'Changed view on trade',
    partial_profit: 'Partial profit booking',
    other: 'Other reason',
    unspecified: 'Unspecified'
  };
  return labels[reason] || reason;
}

module.exports = {
  analyzeStopLossMovements,
  analyzeEarlyExits,
  getIndisciplineAnalysis
};
