/**
 * Discipline Score Service
 * Calculates discipline scores and provides analytics on rule compliance
 */

const Trade = require('../models/Trade');
const TradingRule = require('../models/TradingRule');
const TradeRuleCheck = require('../models/TradeRuleCheck');
const UserTradingConfig = require('../models/UserTradingConfig');

/**
 * Calculate discipline score for a single trade's rule check
 */
function calculateTradeScore(ruleCheckResult) {
  if (!ruleCheckResult || ruleCheckResult.totalRules === 0) {
    return 100;
  }
  
  return ruleCheckResult.disciplineScore || 100;
}

/**
 * Calculate average discipline score for a period
 */
async function calculatePeriodScore(userId, periodDays = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const checks = await TradeRuleCheck.find({
    user: userId,
    checkedAt: { $gte: startDate },
    disciplineScore: { $exists: true }
  });
  
  if (checks.length === 0) {
    return {
      overallScore: 0,
      score: 0,
      totalTrades: 0,
      totalChecks: 0,
      compliantTrades: 0,
      period: `${periodDays} days`
    };
  }
  
  const avgScore = Math.round(
    checks.reduce((sum, c) => sum + (c.disciplineScore || 100), 0) / checks.length
  );
  
  const compliantTrades = checks.filter(c => c.warnings === 0 && c.blocks === 0).length;
  
  return {
    overallScore: avgScore,
    score: avgScore,
    totalTrades: checks.length,
    totalChecks: checks.length,
    period: `${periodDays} days`,
    compliantTrades,
    tradesWithWarnings: checks.filter(c => c.warnings > 0).length,
    blockedTrades: checks.filter(c => !c.tradeAllowed).length
  };
}

/**
 * Get compliance breakdown by rule type
 */
async function getComplianceByRule(userId, periodDays = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const checks = await TradeRuleCheck.find({
    user: userId,
    checkedAt: { $gte: startDate }
  });
  
  // Aggregate by rule type
  const byRuleType = {};
  
  checks.forEach(check => {
    check.ruleResults.forEach(result => {
      if (!byRuleType[result.ruleType]) {
        byRuleType[result.ruleType] = {
          ruleType: result.ruleType,
          ruleName: result.ruleName,
          totalChecks: 0,
          passed: 0,
          warnings: 0,
          blocks: 0
        };
      }
      
      byRuleType[result.ruleType].totalChecks++;
      if (result.passed) {
        byRuleType[result.ruleType].passed++;
      } else if (result.action === 'warn') {
        byRuleType[result.ruleType].warnings++;
      } else {
        byRuleType[result.ruleType].blocks++;
      }
    });
  });
  
  // Calculate compliance percentage and sort
  const results = Object.values(byRuleType).map(rule => ({
    ...rule,
    complianceRate: rule.totalChecks > 0 
      ? Math.round((rule.passed / rule.totalChecks) * 100)
      : 100
  })).sort((a, b) => a.complianceRate - b.complianceRate);
  
  return results;
}

/**
 * Calculate correlation between rule compliance and win rate
 */
async function getComplianceCorrelation(userId, periodDays = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  // Get trades with rule checks
  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate },
    result: { $in: ['win', 'loss'] }
  }).populate('ruleCheck');
  
  // Separate compliant vs non-compliant trades
  const compliantTrades = [];
  const nonCompliantTrades = [];
  
  trades.forEach(trade => {
    if (!trade.ruleCheck) {
      // No rule check = assume compliant
      compliantTrades.push(trade);
    } else if (trade.ruleCheck.warnings === 0 && trade.ruleCheck.blocks === 0) {
      compliantTrades.push(trade);
    } else {
      nonCompliantTrades.push(trade);
    }
  });
  
  // Calculate win rates
  const compliantWins = compliantTrades.filter(t => t.result === 'win').length;
  const compliantWinRate = compliantTrades.length > 0 
    ? Math.round((compliantWins / compliantTrades.length) * 100)
    : 0;
  
  const nonCompliantWins = nonCompliantTrades.filter(t => t.result === 'win').length;
  const nonCompliantWinRate = nonCompliantTrades.length > 0
    ? Math.round((nonCompliantWins / nonCompliantTrades.length) * 100)
    : 0;
  
  // Calculate P/L
  const compliantPnL = compliantTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const nonCompliantPnL = nonCompliantTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  const winRateDifference = compliantWinRate - nonCompliantWinRate;
  
  return {
    compliantTrades: compliantTrades.length,
    nonCompliantTrades: nonCompliantTrades.length,
    winRateWhenCompliant: compliantWinRate,
    winRateWhenViolating: nonCompliantWinRate,
    winRateDifference,
    pnlWhenCompliant: compliantPnL,
    pnlWhenViolating: nonCompliantPnL,
    insight: generateCorrelationInsight(winRateDifference, compliantPnL, nonCompliantPnL)
  };
}

/**
 * Generate human-readable insight from correlation data
 */
function generateCorrelationInsight(winRateDiff, compliantPnL, nonCompliantPnL) {
  const insights = [];
  
  if (winRateDiff > 15) {
    insights.push(`You win ${winRateDiff}% more often when following your rules`);
  } else if (winRateDiff > 5) {
    insights.push(`Your win rate is ${winRateDiff}% higher when compliant`);
  } else if (winRateDiff < -5) {
    insights.push(`Interestingly, your win rate is slightly lower when compliant - review your rules`);
  } else {
    insights.push(`Your win rate is similar whether compliant or not`);
  }
  
  const pnlDiff = compliantPnL - nonCompliantPnL;
  if (pnlDiff > 0) {
    insights.push(`Compliant trades earned ₹${Math.abs(pnlDiff).toFixed(2)} more than non-compliant trades`);
  } else if (pnlDiff < 0) {
    insights.push(`Non-compliant trades outperformed by ₹${Math.abs(pnlDiff).toFixed(2)} - consider reviewing your rules`);
  }
  
  return insights.join('. ');
}

/**
 * Generate weekly discipline report
 */
async function calculateWeeklyReport(userId) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  // Get all checks for the week
  const checks = await TradeRuleCheck.find({
    user: userId,
    checkedAt: { $gte: startDate, $lte: endDate }
  });
  
  // Get trades for the week
  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate, $lte: endDate }
  });
  
  // Get rules
  const rules = await TradingRule.find({ user: userId });
  
  // Calculate overall score
  const avgScore = checks.length > 0
    ? Math.round(checks.reduce((sum, c) => sum + (c.disciplineScore || 100), 0) / checks.length)
    : 100;
  
  // Get compliance by rule
  const byRule = await getComplianceByRule(userId, 7);
  
  // Get correlation
  const correlation = await getComplianceCorrelation(userId, 7);
  
  // Daily breakdown
  const dailyBreakdown = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayChecks = checks.filter(c => 
      c.checkedAt.toISOString().split('T')[0] === dateStr
    );
    
    const dayTrades = trades.filter(t =>
      t.tradeDate.toISOString().split('T')[0] === dateStr
    );
    
    dailyBreakdown[dateStr] = {
      trades: dayTrades.length,
      checks: dayChecks.length,
      avgScore: dayChecks.length > 0
        ? Math.round(dayChecks.reduce((sum, c) => sum + (c.disciplineScore || 100), 0) / dayChecks.length)
        : null,
      violations: dayChecks.filter(c => c.warnings > 0 || c.blocks > 0).length,
      blocked: dayChecks.filter(c => !c.tradeAllowed).length
    };
  }
  
  // Generate recommendations
  const recommendations = generateRecommendations(byRule, correlation, checks);
  
  // Most violated rules
  const mostViolated = byRule
    .filter(r => r.totalChecks > 0 && r.complianceRate < 100)
    .slice(0, 3);
  
  return {
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    },
    overallScore: avgScore,
    totalTrades: trades.length,
    totalChecks: checks.length,
    compliantTrades: checks.filter(c => c.warnings === 0 && c.blocks === 0).length,
    tradesWithWarnings: checks.filter(c => c.warnings > 0).length,
    blockedTrades: checks.filter(c => !c.tradeAllowed).length,
    byRule,
    mostViolated,
    correlation,
    dailyBreakdown,
    recommendations,
    rulesCount: rules.length,
    enabledRulesCount: rules.filter(r => r.enabled).length
  };
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(byRule, correlation, checks) {
  const recommendations = [];
  
  // Perfect compliance recognition
  const perfectRules = byRule.filter(r => r.complianceRate === 100 && r.totalChecks >= 3);
  if (perfectRules.length > 0) {
    recommendations.push({
      type: 'positive',
      message: `Excellent discipline on ${perfectRules.map(r => r.ruleName).join(', ')}! 100% compliance.`
    });
  }
  
  // Problematic rules
  const problemRules = byRule.filter(r => r.complianceRate < 70 && r.totalChecks >= 3);
  problemRules.forEach(rule => {
    recommendations.push({
      type: 'warning',
      message: `Consider strengthening "${rule.ruleName}" - only ${rule.complianceRate}% compliance. ` +
        (rule.blocks > 0 ? `${rule.blocks} trades were blocked.` : '')
    });
  });
  
  // Win rate correlation
  if (correlation.winRateDifference > 10 && correlation.compliantTrades >= 5 && correlation.nonCompliantTrades >= 3) {
    recommendations.push({
      type: 'insight',
      message: `Following rules pays off: ${correlation.winRateDifference}% higher win rate when compliant.`
    });
  } else if (correlation.winRateDifference < -10 && correlation.compliantTrades >= 5) {
    recommendations.push({
      type: 'review',
      message: `Your rules may be too restrictive. Win rate is ${Math.abs(correlation.winRateDifference)}% lower when compliant. Review if rules match your strategy.`
    });
  }
  
  // Emotional patterns
  const emotionViolations = checks.filter(c => c.emotionalState && !c.emotionPassed);
  if (emotionViolations.length > 0) {
    const emotions = [...new Set(emotionViolations.map(c => c.emotionalState))];
    recommendations.push({
      type: 'warning',
      message: `${emotionViolations.length} trades attempted while in blocked emotional states (${emotions.join(', ')}). Consider your emotional triggers.`
    });
  }
  
  // If no rules
  if (byRule.length === 0) {
    recommendations.push({
      type: 'suggestion',
      message: `You haven't set up any trading rules yet. Define rules to track your discipline and improve consistency.`
    });
  }
  
  return recommendations;
}

/**
 * Get violation history
 */
async function getViolations(userId, options = {}) {
  const { periodDays = 30, limit = 50 } = options;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const checks = await TradeRuleCheck.find({
    user: userId,
    checkedAt: { $gte: startDate },
    $or: [
      { warnings: { $gt: 0 } },
      { blocks: { $gt: 0 } }
    ]
  })
  .sort({ checkedAt: -1 })
  .limit(limit)
  .populate('trade', 'symbol entryPrice quantity direction result profitLoss');
  
  return checks.map(check => ({
    id: check._id,
    date: check.checkedAt,
    tradeAllowed: check.tradeAllowed,
    trade: check.trade,
    intendedTrade: check.intendedTrade,
    violations: check.ruleResults.filter(r => !r.passed).map(r => ({
      ruleName: r.ruleName,
      ruleType: r.ruleType,
      action: r.action,
      message: r.message
    })),
    checklistFailures: check.checklistResponses.filter(r => !r.passed),
    emotionalState: check.emotionalState,
    emotionPassed: check.emotionPassed,
    disciplineScore: check.disciplineScore
  }));
}

/**
 * Get suggestions for new rules based on trading patterns
 */
async function getRuleSuggestions(userId) {
  const suggestions = [];
  
  // Get recent trades
  const recentTrades = await Trade.find({
    user: userId
  }).sort({ tradeDate: -1 }).limit(100);
  
  if (recentTrades.length < 10) {
    return [{
      type: 'info',
      message: 'Trade more to get personalized rule suggestions'
    }];
  }
  
  // Get existing rules
  const existingRules = await TradingRule.find({ user: userId });
  const existingTypes = existingRules.map(r => r.ruleType);
  
  // Analyze patterns for suggestions
  
  // 1. Time analysis - suggest TIME_WINDOW if losses cluster at specific times
  if (!existingTypes.includes('TIME_WINDOW')) {
    const hourlyPerformance = {};
    recentTrades.forEach(trade => {
      const hour = new Date(trade.entryTime || trade.tradeDate).getHours();
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = { wins: 0, losses: 0 };
      }
      if (trade.result === 'win') hourlyPerformance[hour].wins++;
      if (trade.result === 'loss') hourlyPerformance[hour].losses++;
    });
    
    // Find worst performing hours
    const worstHours = Object.entries(hourlyPerformance)
      .filter(([, data]) => data.wins + data.losses >= 3)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        winRate: data.wins / (data.wins + data.losses) * 100
      }))
      .filter(h => h.winRate < 35);
    
    if (worstHours.length > 0) {
      suggestions.push({
        type: 'TIME_WINDOW',
        reason: `Your win rate drops significantly during ${worstHours.map(h => `${h.hour}:00`).join(', ')}`,
        suggestion: `Consider avoiding trading during these hours`
      });
    }
  }
  
  // 2. Trade count analysis
  if (!existingTypes.includes('MAX_DAILY_TRADES')) {
    // Group by day
    const tradesByDay = {};
    recentTrades.forEach(trade => {
      const day = trade.tradeDate.toISOString().split('T')[0];
      if (!tradesByDay[day]) tradesByDay[day] = [];
      tradesByDay[day].push(trade);
    });
    
    // Find days with many trades and analyze performance
    const highVolumeDays = Object.entries(tradesByDay)
      .filter(([, trades]) => trades.length > 5);
    
    if (highVolumeDays.length > 0) {
      const avgWinRateHighVolume = highVolumeDays.reduce((sum, [, trades]) => {
        const wins = trades.filter(t => t.result === 'win').length;
        const total = trades.filter(t => t.result === 'win' || t.result === 'loss').length;
        return sum + (total > 0 ? wins / total : 0);
      }, 0) / highVolumeDays.length * 100;
      
      if (avgWinRateHighVolume < 40) {
        suggestions.push({
          type: 'MAX_DAILY_TRADES',
          reason: `On days with 5+ trades, your win rate drops to ${avgWinRateHighVolume.toFixed(0)}%`,
          suggestion: 'Consider limiting your daily trade count'
        });
      }
    }
  }
  
  // 3. Stop loss suggestion
  if (!existingTypes.includes('REQUIRED_STOP_LOSS')) {
    const tradesWithoutSL = recentTrades.filter(t => !t.stopLoss);
    const tradesWithSL = recentTrades.filter(t => t.stopLoss);
    
    if (tradesWithoutSL.length > tradesWithSL.length) {
      const lossesWithoutSL = tradesWithoutSL.filter(t => t.result === 'loss');
      const avgLossWithoutSL = lossesWithoutSL.length > 0
        ? lossesWithoutSL.reduce((sum, t) => sum + Math.abs(t.profitLoss || 0), 0) / lossesWithoutSL.length
        : 0;
      
      suggestions.push({
        type: 'REQUIRED_STOP_LOSS',
        reason: `${tradesWithoutSL.length} of ${recentTrades.length} trades don't have stop loss set`,
        suggestion: `Average loss without SL is ₹${avgLossWithoutSL.toFixed(2)}`
      });
    }
  }
  
  // 4. Consecutive losses pattern
  if (!existingTypes.includes('MAX_CONSECUTIVE_LOSSES')) {
    let maxStreak = 0;
    let currentStreak = 0;
    
    recentTrades.forEach(trade => {
      if (trade.result === 'loss') {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (trade.result === 'win') {
        currentStreak = 0;
      }
    });
    
    if (maxStreak >= 4) {
      suggestions.push({
        type: 'MAX_CONSECUTIVE_LOSSES',
        reason: `You've had losing streaks of up to ${maxStreak} trades`,
        suggestion: 'Consider taking a break after consecutive losses to reset mentally'
      });
    }
  }
  
  return suggestions;
}

module.exports = {
  calculateTradeScore,
  calculatePeriodScore,
  calculateWeeklyReport,
  getComplianceByRule,
  getComplianceCorrelation,
  getViolations,
  getRuleSuggestions,
  generateRecommendations
};
