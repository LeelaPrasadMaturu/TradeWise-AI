/**
 * Edge Analysis Service
 * Provides comprehensive statistics by: time, symbol, setup, day, emotion
 * Helps traders understand "where their actual edge is"
 */

const Trade = require('../models/Trade');
const UserBaseline = require('../models/UserBaseline');

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  const absAmount = Math.abs(amount);
  if (absAmount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (absAmount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

/**
 * Calculate statistics for a group of trades
 */
function calculateStats(trades) {
  if (!trades || trades.length === 0) {
    return null;
  }
  
  const closed = trades.filter(t => t.result && t.result !== 'open');
  const wins = closed.filter(t => t.result === 'win');
  const losses = closed.filter(t => t.result === 'loss');
  
  const totalPnL = closed.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const avgPnL = closed.length > 0 ? totalPnL / closed.length : 0;
  
  const winAmount = wins.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const lossAmount = Math.abs(losses.reduce((sum, t) => sum + (t.profitLoss || 0), 0));
  
  const profitFactor = lossAmount > 0 ? winAmount / lossAmount : (winAmount > 0 ? Infinity : 0);
  const avgWin = wins.length > 0 ? winAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? lossAmount / losses.length : 0;
  const expectancy = closed.length > 0 
    ? ((wins.length / closed.length) * avgWin) - ((losses.length / closed.length) * avgLoss)
    : 0;
  
  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: closed.filter(t => t.result === 'breakeven').length,
    winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
    totalPnL: Math.round(totalPnL),
    avgPnL: Math.round(avgPnL),
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    profitFactor: profitFactor === Infinity ? '∞' : Math.round(profitFactor * 100) / 100,
    expectancy: Math.round(expectancy),
    largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.profitLoss || 0)) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.profitLoss || 0)) : 0
  };
}

/**
 * Get comprehensive edge analysis
 */
async function getEdgeAnalysis(userId, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate }
  }).lean();
  
  if (trades.length < 10) {
    return { 
      message: 'Need at least 10 trades for meaningful edge analysis',
      totalTrades: trades.length 
    };
  }
  
  const baseline = await UserBaseline.findOne({ user: userId });
  
  return {
    periodDays: days,
    totalTrades: trades.length,
    overall: calculateStats(trades),
    byHour: analyzeByHour(trades),
    byDayOfWeek: analyzeByDayOfWeek(trades),
    bySymbol: analyzeBySymbol(trades),
    bySetup: analyzeBySetup(trades),
    byEmotion: analyzeByEmotion(trades),
    byDirection: analyzeByDirection(trades),
    bySession: analyzeBySession(trades),
    edgeSummary: generateEdgeSummary(trades, baseline)
  };
}

/**
 * Analyze by hour of day
 */
function analyzeByHour(trades) {
  const byHour = {};
  
  trades.forEach(trade => {
    const hour = new Date(trade.entryTime || trade.tradeDate).getHours();
    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(trade);
  });
  
  const hourlyStats = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourTrades = byHour[hour] || [];
    if (hourTrades.length >= 3) { // Minimum sample size
      hourlyStats.push({
        hour,
        label: `${hour}:00 - ${hour}:59`,
        ...calculateStats(hourTrades)
      });
    }
  }
  
  // Sort by win rate descending
  hourlyStats.sort((a, b) => b.winRate - a.winRate);
  
  return {
    all: hourlyStats,
    best: hourlyStats.slice(0, 3),
    worst: hourlyStats.slice(-3).reverse(),
    recommendation: hourlyStats.length > 0 
      ? `Your best trading hours are ${hourlyStats.slice(0, 2).map(h => `${h.hour}:00`).join(' and ')}`
      : 'Not enough data to determine best hours'
  };
}

/**
 * Analyze by day of week
 */
function analyzeByDayOfWeek(trades) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  
  trades.forEach(trade => {
    const day = new Date(trade.entryTime || trade.tradeDate).getDay();
    byDay[day].push(trade);
  });
  
  const dayStats = [];
  for (let day = 0; day < 7; day++) {
    const dayTrades = byDay[day];
    if (dayTrades.length >= 3) {
      dayStats.push({
        day,
        dayName: days[day],
        ...calculateStats(dayTrades)
      });
    }
  }
  
  dayStats.sort((a, b) => b.winRate - a.winRate);
  
  return {
    all: dayStats,
    best: dayStats.slice(0, 2),
    worst: dayStats.slice(-2).reverse(),
    recommendation: dayStats.length > 0
      ? `${dayStats[0]?.dayName || 'N/A'} is your best day (${dayStats[0]?.winRate || 0}% WR). Consider reducing size on ${dayStats[dayStats.length - 1]?.dayName || 'N/A'}.`
      : 'Not enough data'
  };
}

/**
 * Analyze by symbol
 */
function analyzeBySymbol(trades) {
  const bySymbol = {};
  
  trades.forEach(trade => {
    const symbol = trade.symbol?.toUpperCase() || 'UNKNOWN';
    if (!bySymbol[symbol]) bySymbol[symbol] = [];
    bySymbol[symbol].push(trade);
  });
  
  const symbolStats = Object.entries(bySymbol)
    .filter(([_, trades]) => trades.length >= 3)
    .map(([symbol, trades]) => ({
      symbol,
      ...calculateStats(trades)
    }));
  
  // Sort by total P&L
  symbolStats.sort((a, b) => b.totalPnL - a.totalPnL);
  
  const profitable = symbolStats.filter(s => s.totalPnL > 0);
  const unprofitable = symbolStats.filter(s => s.totalPnL < 0);
  
  return {
    all: symbolStats,
    mostProfitable: profitable.slice(0, 5),
    leastProfitable: unprofitable.slice(-5).reverse(),
    recommendation: unprofitable.length > 0
      ? `Consider avoiding or reducing size in: ${unprofitable.slice(0, 3).map(s => s.symbol).join(', ')}`
      : 'All your traded symbols are profitable!'
  };
}

/**
 * Analyze by setup/tags
 */
function analyzeBySetup(trades) {
  const bySetup = {};
  
  trades.forEach(trade => {
    const tags = trade.tags || [];
    if (tags.length === 0) {
      if (!bySetup['untagged']) bySetup['untagged'] = [];
      bySetup['untagged'].push(trade);
    } else {
      tags.forEach(tag => {
        const normalizedTag = tag.toLowerCase().trim();
        if (!bySetup[normalizedTag]) bySetup[normalizedTag] = [];
        bySetup[normalizedTag].push(trade);
      });
    }
  });
  
  const setupStats = Object.entries(bySetup)
    .filter(([_, trades]) => trades.length >= 3)
    .map(([setup, trades]) => ({
      setup,
      ...calculateStats(trades)
    }));
  
  setupStats.sort((a, b) => b.winRate - a.winRate);
  
  const profitable = setupStats.filter(s => s.totalPnL > 0 && s.setup !== 'untagged');
  const unprofitable = setupStats.filter(s => s.totalPnL < 0 && s.setup !== 'untagged');
  
  return {
    all: setupStats,
    bestSetups: profitable.slice(0, 5),
    worstSetups: unprofitable.slice(-5).reverse(),
    untaggedStats: bySetup['untagged'] ? calculateStats(bySetup['untagged']) : null,
    recommendation: profitable.length > 0
      ? `Your edge is strongest in: ${profitable.slice(0, 2).map(s => s.setup).join(', ')} setups`
      : 'Tag your trades to discover which setups work best'
  };
}

/**
 * Analyze by pre-trade emotion
 */
function analyzeByEmotion(trades) {
  const byEmotion = {};
  
  trades.forEach(trade => {
    const emotion = trade.preTradeEmotion || trade.emotionAnalysis?.detected || 'unknown';
    if (!byEmotion[emotion]) byEmotion[emotion] = [];
    byEmotion[emotion].push(trade);
  });
  
  const emotionStats = Object.entries(byEmotion)
    .filter(([_, trades]) => trades.length >= 3)
    .map(([emotion, trades]) => ({
      emotion,
      ...calculateStats(trades)
    }));
  
  emotionStats.sort((a, b) => b.winRate - a.winRate);
  
  const goodEmotions = emotionStats.filter(e => e.winRate >= 50 && e.emotion !== 'unknown');
  const badEmotions = emotionStats.filter(e => e.winRate < 45 && e.emotion !== 'unknown');
  
  return {
    all: emotionStats,
    bestEmotions: goodEmotions.slice(0, 3),
    worstEmotions: badEmotions,
    recommendation: badEmotions.length > 0
      ? `Avoid trading when feeling: ${badEmotions.map(e => e.emotion).join(', ')}`
      : 'Your emotional awareness is helping your trading!'
  };
}

/**
 * Analyze by direction (long vs short)
 */
function analyzeByDirection(trades) {
  const longs = trades.filter(t => t.direction === 'long');
  const shorts = trades.filter(t => t.direction === 'short');
  
  const longStats = calculateStats(longs);
  const shortStats = calculateStats(shorts);
  
  let recommendation = '';
  if (longStats && shortStats) {
    if (longStats.winRate > shortStats.winRate + 10) {
      recommendation = `You have a clear long bias (${longStats.winRate}% vs ${shortStats.winRate}%). Consider sizing down on shorts.`;
    } else if (shortStats.winRate > longStats.winRate + 10) {
      recommendation = `You perform better on shorts (${shortStats.winRate}% vs ${longStats.winRate}%). Consider more short opportunities.`;
    } else {
      recommendation = `Balanced performance on both sides. Keep diversifying.`;
    }
  }
  
  return {
    long: longStats,
    short: shortStats,
    recommendation
  };
}

/**
 * Analyze by trading session (pre-market, market open, midday, close)
 */
function analyzeBySession(trades) {
  const sessions = {
    'pre-market': { start: 8, end: 9, trades: [] },
    'market-open': { start: 9, end: 10, trades: [] },
    'morning': { start: 10, end: 12, trades: [] },
    'midday': { start: 12, end: 14, trades: [] },
    'afternoon': { start: 14, end: 15, trades: [] },
    'close': { start: 15, end: 16, trades: [] }
  };
  
  trades.forEach(trade => {
    const hour = new Date(trade.entryTime || trade.tradeDate).getHours();
    for (const [session, config] of Object.entries(sessions)) {
      if (hour >= config.start && hour < config.end) {
        config.trades.push(trade);
        break;
      }
    }
  });
  
  const sessionStats = Object.entries(sessions)
    .filter(([_, config]) => config.trades.length >= 3)
    .map(([session, config]) => ({
      session,
      timeRange: `${config.start}:00 - ${config.end}:00`,
      ...calculateStats(config.trades)
    }));
  
  sessionStats.sort((a, b) => b.winRate - a.winRate);
  
  return {
    all: sessionStats,
    best: sessionStats[0] || null,
    worst: sessionStats[sessionStats.length - 1] || null,
    recommendation: sessionStats.length > 0
      ? `Best session: ${sessionStats[0]?.session} (${sessionStats[0]?.winRate}% WR)`
      : 'Not enough session data'
  };
}

/**
 * Generate overall edge summary with actionable insights
 */
function generateEdgeSummary(trades, baseline) {
  const stats = calculateStats(trades);
  if (!stats) return null;
  
  const insights = [];
  const strengths = [];
  const weaknesses = [];
  
  // Overall edge assessment
  if (stats.expectancy > 0) {
    strengths.push(`Positive expectancy of ₹${stats.expectancy} per trade`);
  } else {
    weaknesses.push(`Negative expectancy of ₹${Math.abs(stats.expectancy)} per trade - focus on improving win rate or R:R`);
  }
  
  if (stats.profitFactor !== '∞' && stats.profitFactor >= 1.5) {
    strengths.push(`Strong profit factor of ${stats.profitFactor}`);
  } else if (stats.profitFactor !== '∞' && stats.profitFactor < 1) {
    weaknesses.push(`Profit factor below 1 (${stats.profitFactor}) - losing more than winning`);
  }
  
  if (stats.winRate >= 50) {
    strengths.push(`Above 50% win rate (${stats.winRate}%)`);
  } else {
    weaknesses.push(`Win rate below 50% (${stats.winRate}%) - need better entries or setups`);
  }
  
  // R:R assessment
  if (stats.avgWin > 0 && stats.avgLoss > 0) {
    const rr = stats.avgWin / stats.avgLoss;
    if (rr >= 1.5) {
      strengths.push(`Good R:R ratio of ${rr.toFixed(2)}`);
    } else if (rr < 1) {
      weaknesses.push(`Poor R:R ratio (${rr.toFixed(2)}) - winners smaller than losers`);
    }
  }
  
  return {
    overallPnL: stats.totalPnL,
    overallPnLFormatted: formatCurrency(stats.totalPnL),
    expectancy: stats.expectancy,
    profitFactor: stats.profitFactor,
    winRate: stats.winRate,
    strengths,
    weaknesses,
    primaryEdge: strengths.length > 0 ? strengths[0] : 'Still developing your edge',
    focusArea: weaknesses.length > 0 ? weaknesses[0] : 'Maintain current discipline'
  };
}

/**
 * Get edge comparison between two periods
 */
async function compareEdge(userId, currentDays = 30, previousDays = 30) {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - currentDays);
  
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - previousDays);
  
  const [currentTrades, previousTrades] = await Promise.all([
    Trade.find({
      user: userId,
      tradeDate: { $gte: currentStart }
    }).lean(),
    Trade.find({
      user: userId,
      tradeDate: { $gte: previousStart, $lt: currentStart }
    }).lean()
  ]);
  
  const currentStats = calculateStats(currentTrades);
  const previousStats = calculateStats(previousTrades);
  
  if (!currentStats || !previousStats) {
    return { message: 'Not enough data for comparison' };
  }
  
  return {
    current: {
      period: `Last ${currentDays} days`,
      ...currentStats
    },
    previous: {
      period: `Previous ${previousDays} days`,
      ...previousStats
    },
    changes: {
      winRate: currentStats.winRate - previousStats.winRate,
      totalPnL: currentStats.totalPnL - previousStats.totalPnL,
      avgPnL: currentStats.avgPnL - previousStats.avgPnL,
      profitFactor: currentStats.profitFactor === '∞' || previousStats.profitFactor === '∞' 
        ? 'N/A' 
        : Math.round((currentStats.profitFactor - previousStats.profitFactor) * 100) / 100
    },
    trending: currentStats.totalPnL > previousStats.totalPnL ? 'improving' : 'declining'
  };
}

module.exports = {
  getEdgeAnalysis,
  compareEdge,
  calculateStats
};
