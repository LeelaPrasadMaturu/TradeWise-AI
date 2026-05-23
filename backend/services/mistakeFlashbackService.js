/**
 * Mistake Flashback Service
 * Generates warnings based on past trading mistakes before entering new trades
 * Shows "Last X times you did Y, you lost Z" type warnings
 */

const Trade = require('../models/Trade');
const UserBaseline = require('../models/UserBaseline');
const behavioralPatternService = require('./behavioralPatternService');

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  const absAmount = Math.abs(amount);
  if (absAmount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  } else if (absAmount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
}

/**
 * Get recent losing trades for a specific symbol
 */
async function getSymbolLosses(userId, symbol, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const losses = await Trade.find({
    user: userId,
    symbol: { $regex: new RegExp(`^${symbol}$`, 'i') },
    result: 'loss',
    tradeDate: { $gte: startDate }
  })
  .sort({ tradeDate: -1 })
  .limit(10)
  .lean();
  
  return losses;
}

/**
 * Get symbol performance statistics
 */
async function getSymbolStats(userId, symbol, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const trades = await Trade.find({
    user: userId,
    symbol: { $regex: new RegExp(`^${symbol}$`, 'i') },
    result: { $in: ['win', 'loss', 'breakeven'] },
    tradeDate: { $gte: startDate }
  }).lean();
  
  if (trades.length === 0) return null;
  
  const wins = trades.filter(t => t.result === 'win').length;
  const losses = trades.filter(t => t.result === 'loss').length;
  const totalPnL = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    totalPnL,
    avgPnL: trades.length > 0 ? totalPnL / trades.length : 0
  };
}

/**
 * Check if today is the first trade
 */
async function isFirstTradeOfDay(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tradesCount = await Trade.countDocuments({
    user: userId,
    tradeDate: { $gte: today }
  });
  
  return tradesCount === 0;
}

/**
 * Get recent consecutive losses (tilt detection)
 */
async function getRecentConsecutiveLosses(userId) {
  const recentTrades = await Trade.find({
    user: userId,
    result: { $in: ['win', 'loss'] }
  })
  .sort({ tradeDate: -1, entryTime: -1 })
  .limit(10)
  .lean();
  
  let consecutiveLosses = 0;
  let totalLoss = 0;
  
  for (const trade of recentTrades) {
    if (trade.result === 'loss') {
      consecutiveLosses++;
      totalLoss += Math.abs(trade.profitLoss || 0);
    } else {
      break;
    }
  }
  
  return { consecutiveLosses, totalLoss };
}

/**
 * Get flashback warnings based on current context
 * @param {string} userId
 * @param {Object} context - { symbol?, currentHour?, emotion?, isFirstTrade? }
 * @returns {Promise<Array>} Array of warning objects
 */
async function getFlashbackWarnings(userId, context = {}) {
  const warnings = [];
  
  // Get user baseline
  let baseline = await UserBaseline.findOne({ user: userId }).lean();
  if (!baseline) {
    // Try to calculate baseline if not exists
    try {
      baseline = await behavioralPatternService.calculateUserBaseline(userId);
    } catch (e) {
      baseline = null;
    }
  }
  
  const currentHour = context.currentHour !== undefined 
    ? context.currentHour 
    : new Date().getHours();
  
  // 1. Symbol-based flashback
  if (context.symbol) {
    const symbolStats = await getSymbolStats(userId, context.symbol);
    
    if (symbolStats) {
      // Warning if win rate is significantly below baseline
      if (symbolStats.totalTrades >= 3 && symbolStats.winRate < 40) {
        const losses = await getSymbolLosses(userId, context.symbol);
        const recentLosses = losses.slice(0, 3);
        const totalLoss = recentLosses.reduce((sum, t) => sum + Math.abs(t.profitLoss || 0), 0);
        
        warnings.push({
          type: 'SYMBOL_HISTORY',
          severity: symbolStats.winRate < 30 ? 'high' : 'medium',
          title: 'Poor Symbol Performance',
          message: `Your win rate on ${context.symbol} is only ${symbolStats.winRate.toFixed(0)}% (${symbolStats.wins}W/${symbolStats.losses}L)`,
          detail: recentLosses.length > 0 
            ? `Last ${recentLosses.length} losses totaled ${formatCurrency(totalLoss)}`
            : null,
          data: {
            symbol: context.symbol,
            winRate: symbolStats.winRate,
            totalPnL: symbolStats.totalPnL,
            trades: symbolStats.totalTrades
          },
          recentTrades: recentLosses.map(t => ({
            date: t.tradeDate,
            pnl: t.profitLoss,
            reason: t.reason
          }))
        });
      }
      
      // Warning if consistently losing money on this symbol
      if (symbolStats.totalTrades >= 5 && symbolStats.totalPnL < 0) {
        warnings.push({
          type: 'SYMBOL_LOSING',
          severity: 'medium',
          title: 'Net Negative Symbol',
          message: `You've lost ${formatCurrency(Math.abs(symbolStats.totalPnL))} on ${context.symbol} across ${symbolStats.totalTrades} trades`,
          detail: 'Consider avoiding this symbol or reviewing your strategy',
          data: {
            symbol: context.symbol,
            totalPnL: symbolStats.totalPnL,
            avgLoss: symbolStats.avgPnL
          }
        });
      }
    }
  }
  
  // 2. Time-based flashback (bad hour warning)
  if (baseline && baseline.hourlyPerformance) {
    const hourPerf = baseline.hourlyPerformance.find(h => h.hour === currentHour);
    
    if (hourPerf && hourPerf.tradeCount >= 5) {
      const baselineWinRate = baseline.baselineWinRate || 50;
      const winRateDiff = hourPerf.winRate - baselineWinRate;
      
      if (winRateDiff < -15) {
        warnings.push({
          type: 'BAD_HOUR',
          severity: winRateDiff < -25 ? 'high' : 'medium',
          title: 'Weak Trading Hour',
          message: `Your win rate at ${currentHour}:00 is ${hourPerf.winRate.toFixed(0)}% vs ${baselineWinRate.toFixed(0)}% overall`,
          detail: `You've traded ${hourPerf.tradeCount} times at this hour with ${formatCurrency(hourPerf.totalPnL)} P&L`,
          data: {
            hour: currentHour,
            hourWinRate: hourPerf.winRate,
            baselineWinRate,
            hourPnL: hourPerf.totalPnL
          }
        });
      }
    }
  }
  
  // 3. Day-of-week flashback
  if (baseline && baseline.dailyPerformance) {
    const dayOfWeek = new Date().getDay();
    const dayPerf = baseline.dailyPerformance.find(d => d.dayOfWeek === dayOfWeek);
    
    if (dayPerf && dayPerf.tradeCount >= 5) {
      const baselineWinRate = baseline.baselineWinRate || 50;
      const winRateDiff = dayPerf.winRate - baselineWinRate;
      
      if (winRateDiff < -10) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        warnings.push({
          type: 'BAD_DAY',
          severity: winRateDiff < -20 ? 'high' : 'medium',
          title: 'Weak Trading Day',
          message: `Your win rate on ${dayNames[dayOfWeek]}s is ${dayPerf.winRate.toFixed(0)}% vs ${baselineWinRate.toFixed(0)}% overall`,
          detail: `Historical P&L on ${dayNames[dayOfWeek]}s: ${formatCurrency(dayPerf.totalPnL)}`,
          data: {
            dayOfWeek,
            dayName: dayNames[dayOfWeek],
            dayWinRate: dayPerf.winRate,
            baselineWinRate
          }
        });
      }
    }
  }
  
  // 4. First trade syndrome
  const isFirstTrade = context.isFirstTrade !== undefined 
    ? context.isFirstTrade 
    : await isFirstTradeOfDay(userId);
    
  if (isFirstTrade && baseline) {
    // Check if user has first trade syndrome pattern
    const recentTrades = await Trade.find({
      user: userId,
      result: { $in: ['win', 'loss'] }
    })
    .sort({ tradeDate: -1 })
    .limit(100)
    .lean();
    
    // Group by day and check first trade performance
    const tradesByDay = {};
    recentTrades.forEach(t => {
      const dayKey = new Date(t.tradeDate).toDateString();
      if (!tradesByDay[dayKey]) tradesByDay[dayKey] = [];
      tradesByDay[dayKey].push(t);
    });
    
    let firstTradeWins = 0;
    let firstTradeLosses = 0;
    let firstTradeTotalPnL = 0;
    
    Object.values(tradesByDay).forEach(dayTrades => {
      // Sort by time to get first trade
      dayTrades.sort((a, b) => new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate));
      const firstTrade = dayTrades[0];
      if (firstTrade.result === 'win') firstTradeWins++;
      else if (firstTrade.result === 'loss') firstTradeLosses++;
      firstTradeTotalPnL += firstTrade.profitLoss || 0;
    });
    
    const totalFirstTrades = firstTradeWins + firstTradeLosses;
    const firstTradeWinRate = totalFirstTrades > 0 ? (firstTradeWins / totalFirstTrades) * 100 : 50;
    const baselineWinRate = baseline.baselineWinRate || 50;
    
    if (totalFirstTrades >= 10 && firstTradeWinRate < baselineWinRate - 15) {
      warnings.push({
        type: 'FIRST_TRADE_SYNDROME',
        severity: 'medium',
        title: 'First Trade Caution',
        message: `Your first trade of the day wins only ${firstTradeWinRate.toFixed(0)}% of the time`,
        detail: `Consider waiting or using smaller size. First trade P&L: ${formatCurrency(firstTradeTotalPnL)}`,
        data: {
          firstTradeWinRate,
          baselineWinRate,
          firstTradePnL: firstTradeTotalPnL
        }
      });
    }
  }
  
  // 5. Consecutive loss warning (tilt risk)
  const { consecutiveLosses, totalLoss } = await getRecentConsecutiveLosses(userId);
  
  if (consecutiveLosses >= 2) {
    const severity = consecutiveLosses >= 4 ? 'high' : consecutiveLosses >= 3 ? 'medium' : 'low';
    warnings.push({
      type: 'LOSS_STREAK',
      severity,
      title: 'Loss Streak Active',
      message: `You have ${consecutiveLosses} consecutive losses totaling ${formatCurrency(totalLoss)}`,
      detail: consecutiveLosses >= 3 
        ? 'High tilt risk. Consider taking a break or reducing position size.'
        : 'Be cautious of revenge trading.',
      data: {
        consecutiveLosses,
        totalLoss
      }
    });
  }
  
  // 6. Emotion-based warning
  if (context.emotion && ['revenge', 'fomo', 'frustrated', 'anxious', 'fearful'].includes(context.emotion)) {
    // Get performance when trading with this emotion
    const emotionTrades = await Trade.find({
      user: userId,
      preTradeEmotion: context.emotion,
      result: { $in: ['win', 'loss'] }
    }).lean();
    
    if (emotionTrades.length >= 3) {
      const wins = emotionTrades.filter(t => t.result === 'win').length;
      const winRate = (wins / emotionTrades.length) * 100;
      const totalPnL = emotionTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
      const baselineWinRate = baseline?.baselineWinRate || 50;
      
      if (winRate < baselineWinRate - 10 || totalPnL < 0) {
        const emotionNames = {
          revenge: 'revenge mindset',
          fomo: 'FOMO',
          frustrated: 'frustration',
          anxious: 'anxiety',
          fearful: 'fear'
        };
        
        warnings.push({
          type: 'NEGATIVE_EMOTION',
          severity: 'high',
          title: 'Emotional State Warning',
          message: `Trading with ${emotionNames[context.emotion]} historically loses you money`,
          detail: `${emotionTrades.length} trades with this emotion: ${winRate.toFixed(0)}% win rate, ${formatCurrency(totalPnL)} P&L`,
          data: {
            emotion: context.emotion,
            emotionWinRate: winRate,
            emotionPnL: totalPnL,
            tradeCount: emotionTrades.length
          }
        });
      }
    }
  }
  
  // 7. Pattern-based warnings from behavioral analysis
  try {
    const patterns = await behavioralPatternService.analyzeAllPatterns(userId, '7d');
    
    // Filter for active concerning patterns
    const concerningPatterns = (patterns.patternsDetected || [])
      .filter(p => ['REVENGE_TRADING', 'TILT_STREAK', 'OVERTRADING', 'RAPID_FIRE'].includes(p.type))
      .filter(p => p.severity === 'high' || p.severity === 'medium');
    
    for (const pattern of concerningPatterns.slice(0, 2)) {
      warnings.push({
        type: pattern.type,
        severity: pattern.severity,
        title: formatPatternTitle(pattern.type),
        message: pattern.message || pattern.insight,
        detail: pattern.recommendation,
        data: {
          costEstimate: pattern.costEstimate,
          affectedTrades: pattern.affectedTrades?.length
        }
      });
    }
  } catch (e) {
    // Behavioral analysis might fail, continue without it
  }
  
  // Sort warnings by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return warnings;
}

/**
 * Format pattern type to readable title
 */
function formatPatternTitle(type) {
  const titles = {
    'REVENGE_TRADING': 'Revenge Trading Detected',
    'TILT_STREAK': 'Tilt Warning',
    'OVERTRADING': 'Overtrading Pattern',
    'RAPID_FIRE': 'Rapid Fire Trading',
    'POSITION_SIZE_CHAOS': 'Inconsistent Sizing',
    'FOMO_ENTRY': 'FOMO Pattern'
  };
  return titles[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get a quick summary of all flashback warnings
 */
async function getFlashbackSummary(userId, context = {}) {
  const warnings = await getFlashbackWarnings(userId, context);
  
  return {
    hasWarnings: warnings.length > 0,
    highSeverityCount: warnings.filter(w => w.severity === 'high').length,
    mediumSeverityCount: warnings.filter(w => w.severity === 'medium').length,
    lowSeverityCount: warnings.filter(w => w.severity === 'low').length,
    topWarning: warnings[0] || null,
    warnings
  };
}

module.exports = {
  getFlashbackWarnings,
  getFlashbackSummary,
  getSymbolStats,
  getSymbolLosses,
  isFirstTradeOfDay
};
