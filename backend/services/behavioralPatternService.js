/**
 * Behavioral Pattern Detection Service
 * Detects 15+ psychological trading patterns from trade history
 * Uses auto-detected trading style to apply appropriate thresholds
 */

const Trade = require('../models/Trade');
const UserBaseline = require('../models/UserBaseline');

// Style-specific configuration thresholds
const STYLE_CONFIG = {
  SCALPER: {
    revengeWindowMinutes: 10,
    tiltStreakCount: 6,
    overtradingMultiplier: 2,
    rapidFireMinutes: 2,
    sizeDeviationThreshold: 0.3,
    minTradesForPattern: 20
  },
  INTRADAY: {
    revengeWindowMinutes: 120,
    tiltStreakCount: 4,
    overtradingMultiplier: 3,
    rapidFireMinutes: 30,
    sizeDeviationThreshold: 0.5,
    minTradesForPattern: 10
  },
  SWING: {
    revengeWindowMinutes: 1440,
    tiltStreakCount: 3,
    overtradingMultiplier: 5,
    rapidFireMinutes: 240,
    sizeDeviationThreshold: 0.75,
    minTradesForPattern: 5
  },
  POSITIONAL: {
    revengeWindowMinutes: 4320,
    tiltStreakCount: 2,
    overtradingMultiplier: 10,
    rapidFireMinutes: 1440,
    sizeDeviationThreshold: 1.0,
    minTradesForPattern: 3
  },
  UNKNOWN: {
    revengeWindowMinutes: 120,
    tiltStreakCount: 4,
    overtradingMultiplier: 3,
    rapidFireMinutes: 30,
    sizeDeviationThreshold: 0.5,
    minTradesForPattern: 10
  }
};

/**
 * Detect trading style based on trade frequency and hold duration
 */
function detectTradingStyle(trades, periodDays = 30) {
  if (!trades || trades.length < 5) {
    return { style: 'UNKNOWN', confidence: 0 };
  }

  const avgTradesPerDay = trades.length / periodDays;
  
  // Calculate average hold duration
  const tradesWithDuration = trades.filter(t => t.entryTime && t.exitTime);
  let avgHoldDuration = 240; // Default 4 hours
  
  if (tradesWithDuration.length > 0) {
    const totalDuration = tradesWithDuration.reduce((sum, t) => {
      return sum + (new Date(t.exitTime) - new Date(t.entryTime)) / (1000 * 60);
    }, 0);
    avgHoldDuration = totalDuration / tradesWithDuration.length;
  }

  let style = 'UNKNOWN';
  let confidence = 0;

  if (avgTradesPerDay >= 10 && avgHoldDuration <= 15) {
    style = 'SCALPER';
    confidence = Math.min(1, avgTradesPerDay / 15);
  } else if (avgTradesPerDay >= 3 && avgHoldDuration <= 240) {
    style = 'INTRADAY';
    confidence = Math.min(1, (avgTradesPerDay / 5 + (240 - avgHoldDuration) / 240) / 2);
  } else if (avgTradesPerDay >= 0.2 && avgHoldDuration <= 7200) {
    style = 'SWING';
    confidence = Math.min(1, trades.length / 20);
  } else if (trades.length >= 3) {
    style = 'POSITIONAL';
    confidence = Math.min(1, trades.length / 10);
  }

  return { style, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Calculate median
 */
function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Group trades by day
 */
function groupTradesByDay(trades) {
  const byDay = {};
  trades.forEach(t => {
    const date = new Date(t.entryTime || t.tradeDate).toISOString().split('T')[0];
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(t);
  });
  return byDay;
}

/**
 * Calculate user baseline from trade history
 */
async function calculateUserBaseline(userId, periodDays = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate }
  }).sort({ entryTime: 1, tradeDate: 1 });

  if (trades.length === 0) {
    return await UserBaseline.getOrCreate(userId);
  }

  // Detect trading style
  const { style, confidence } = detectTradingStyle(trades, periodDays);

  // Calculate position sizes
  const positionSizes = trades.map(t => t.positionValue || (t.entryPrice * t.quantity));
  const avgPositionSize = positionSizes.reduce((a, b) => a + b, 0) / positionSizes.length;
  const positionSizeStdDev = calculateStdDev(positionSizes);
  const positionSizeMedian = calculateMedian(positionSizes);

  // Calculate daily trade counts
  const byDay = groupTradesByDay(trades);
  const dailyCounts = Object.values(byDay).map(d => d.length);
  const avgDailyTradeCount = dailyCounts.reduce((a, b) => a + b, 0) / Object.keys(byDay).length;
  const tradeCountStdDev = calculateStdDev(dailyCounts);

  // Calculate hold durations
  const holdDurations = trades
    .filter(t => t.entryTime && t.exitTime)
    .map(t => (new Date(t.exitTime) - new Date(t.entryTime)) / (1000 * 60));
  const avgHoldDurationMinutes = holdDurations.length > 0 
    ? holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length 
    : 0;
  const holdDurationStdDev = calculateStdDev(holdDurations);

  // Win/loss metrics
  const closedTrades = trades.filter(t => t.result && t.result !== 'open');
  const wins = closedTrades.filter(t => t.result === 'win');
  const losses = closedTrades.filter(t => t.result === 'loss');
  
  const baselineWinRate = closedTrades.length > 0 
    ? (wins.length / closedTrades.length) * 100 
    : 0;
  
  const avgWinAmount = wins.length > 0 
    ? wins.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / wins.length 
    : 0;
  
  const avgLossAmount = losses.length > 0 
    ? Math.abs(losses.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / losses.length)
    : 0;

  const totalProfitLoss = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  const totalWins = wins.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.profitLoss || 0), 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // Hourly performance
  const hourlyPerformance = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourTrades = trades.filter(t => {
      const h = new Date(t.entryTime || t.tradeDate).getHours();
      return h === hour;
    });
    if (hourTrades.length > 0) {
      const hourWins = hourTrades.filter(t => t.result === 'win').length;
      const hourClosed = hourTrades.filter(t => t.result && t.result !== 'open').length;
      hourlyPerformance.push({
        hour,
        tradeCount: hourTrades.length,
        winRate: hourClosed > 0 ? (hourWins / hourClosed) * 100 : 0,
        totalPnL: hourTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
      });
    }
  }

  // Daily performance (by day of week)
  const dailyPerformance = [];
  for (let day = 0; day < 7; day++) {
    const dayTrades = trades.filter(t => {
      return new Date(t.entryTime || t.tradeDate).getDay() === day;
    });
    if (dayTrades.length > 0) {
      const dayWins = dayTrades.filter(t => t.result === 'win').length;
      const dayClosed = dayTrades.filter(t => t.result && t.result !== 'open').length;
      dailyPerformance.push({
        dayOfWeek: day,
        tradeCount: dayTrades.length,
        winRate: dayClosed > 0 ? (dayWins / dayClosed) * 100 : 0,
        totalPnL: dayTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
      });
    }
  }

  // Best/worst performing hours
  const sortedHours = [...hourlyPerformance].sort((a, b) => b.winRate - a.winRate);
  const bestPerformingHours = sortedHours.slice(0, 3).map(h => h.hour);
  const worstPerformingHours = sortedHours.slice(-3).map(h => h.hour);

  // Best/worst performing days
  const sortedDays = [...dailyPerformance].sort((a, b) => b.winRate - a.winRate);
  const bestPerformingDays = sortedDays.slice(0, 2).map(d => d.dayOfWeek);
  const worstPerformingDays = sortedDays.slice(-2).map(d => d.dayOfWeek);

  // Symbol performance
  const symbolMap = {};
  trades.forEach(t => {
    if (!symbolMap[t.symbol]) {
      symbolMap[t.symbol] = { trades: [], wins: 0, totalPnL: 0, holdMinutes: [] };
    }
    symbolMap[t.symbol].trades.push(t);
    if (t.result === 'win') symbolMap[t.symbol].wins++;
    symbolMap[t.symbol].totalPnL += t.profitLoss || 0;
    if (t.entryTime && t.exitTime) {
      symbolMap[t.symbol].holdMinutes.push(
        (new Date(t.exitTime) - new Date(t.entryTime)) / (1000 * 60)
      );
    }
  });

  const symbolPerformance = Object.entries(symbolMap).map(([symbol, data]) => ({
    symbol,
    tradeCount: data.trades.length,
    winRate: data.trades.filter(t => t.result && t.result !== 'open').length > 0
      ? (data.wins / data.trades.filter(t => t.result && t.result !== 'open').length) * 100
      : 0,
    totalPnL: data.totalPnL,
    avgHoldMinutes: data.holdMinutes.length > 0
      ? data.holdMinutes.reduce((a, b) => a + b, 0) / data.holdMinutes.length
      : 0
  }));

  // Streak analysis
  let currentWinStreak = 0, currentLossStreak = 0;
  let longestWinStreak = 0, longestLossStreak = 0;
  const winStreaks = [], lossStreaks = [];

  closedTrades.forEach(t => {
    if (t.result === 'win') {
      currentWinStreak++;
      if (currentLossStreak > 0) {
        lossStreaks.push(currentLossStreak);
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      }
      currentLossStreak = 0;
    } else if (t.result === 'loss') {
      currentLossStreak++;
      if (currentWinStreak > 0) {
        winStreaks.push(currentWinStreak);
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      }
      currentWinStreak = 0;
    }
  });
  
  if (currentWinStreak > 0) {
    winStreaks.push(currentWinStreak);
    longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
  }
  if (currentLossStreak > 0) {
    lossStreaks.push(currentLossStreak);
    longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
  }

  const avgWinStreak = winStreaks.length > 0 
    ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length 
    : 0;
  const avgLossStreak = lossStreaks.length > 0 
    ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length 
    : 0;

  // Risk metrics
  const tradesWithStopLoss = trades.filter(t => t.stopLoss).length;
  const tradesWithTakeProfit = trades.filter(t => t.takeProfit).length;
  
  const rrRatios = trades
    .filter(t => t.stopLoss && t.takeProfit && t.entryPrice)
    .map(t => {
      const risk = Math.abs(t.entryPrice - t.stopLoss);
      const reward = Math.abs(t.takeProfit - t.entryPrice);
      return risk > 0 ? reward / risk : 0;
    });
  const avgRiskRewardRatio = rrRatios.length > 0 
    ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length 
    : 0;

  // Calculate max drawdown
  let peak = 0, maxDrawdown = 0, runningPnL = 0;
  closedTrades.forEach(t => {
    runningPnL += t.profitLoss || 0;
    if (runningPnL > peak) peak = runningPnL;
    const drawdown = peak - runningPnL;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  // Update or create baseline
  const baseline = await UserBaseline.findOneAndUpdate(
    { user: userId },
    {
      tradingStyle: style,
      styleConfidence: confidence,
      avgPositionSize,
      avgDailyTradeCount,
      avgHoldDurationMinutes,
      baselineWinRate,
      avgWinAmount,
      avgLossAmount,
      totalProfitLoss,
      profitFactor,
      positionSizeStdDev,
      positionSizeMedian,
      tradeCountStdDev,
      holdDurationStdDev,
      hourlyPerformance,
      dailyPerformance,
      bestPerformingHours,
      worstPerformingHours,
      bestPerformingDays,
      worstPerformingDays,
      symbolPerformance,
      longestWinStreak,
      longestLossStreak,
      avgWinStreak,
      avgLossStreak,
      maxDrawdown,
      avgRiskRewardRatio,
      tradesWithStopLoss,
      tradesWithTakeProfit,
      basedOnTradeCount: trades.length,
      periodDays,
      oldestTradeDate: trades[0]?.tradeDate,
      newestTradeDate: trades[trades.length - 1]?.tradeDate,
      calculatedAt: new Date(),
      version: 1
    },
    { upsert: true, new: true }
  );

  return baseline;
}

// ============================================
// PATTERN DETECTION ALGORITHMS
// ============================================

/**
 * 1. Detect Revenge Trading
 * Entry within style-specific window after loss with larger position size
 */
function detectRevengeTrading(trades, baseline) {
  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  const patterns = [];
  
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate)
  );

  for (let i = 1; i < sortedTrades.length; i++) {
    const prev = sortedTrades[i - 1];
    const curr = sortedTrades[i];
    
    if (prev.result === 'loss') {
      const prevExit = prev.exitTime || prev.tradeDate;
      const currEntry = curr.entryTime || curr.tradeDate;
      const minutesDiff = (new Date(currEntry) - new Date(prevExit)) / (1000 * 60);
      
      const prevSize = prev.positionValue || (prev.entryPrice * prev.quantity);
      const currSize = curr.positionValue || (curr.entryPrice * curr.quantity);
      const sizeRatio = prevSize > 0 ? currSize / prevSize : 1;
      
      const isWithinWindow = minutesDiff >= 0 && minutesDiff <= config.revengeWindowMinutes;
      const isOversized = sizeRatio >= (1 + config.sizeDeviationThreshold);
      
      if (isWithinWindow && isOversized) {
        patterns.push({
          type: 'REVENGE_TRADING',
          severity: sizeRatio > (1 + config.sizeDeviationThreshold * 2) ? 'high' : 'medium',
          triggerTrade: prev._id,
          revengeTrade: curr._id,
          sizeIncrease: ((sizeRatio - 1) * 100).toFixed(1) + '%',
          timeAfterLoss: minutesDiff < 60 
            ? `${Math.round(minutesDiff)} minutes` 
            : `${(minutesDiff / 60).toFixed(1)} hours`,
          outcome: curr.result,
          pnlImpact: curr.profitLoss || 0
        });
      }
    }
  }
  
  return patterns;
}

/**
 * 2. Detect Tilt Streak
 * Multiple consecutive losses in short time window
 */
function detectTiltStreak(trades, baseline) {
  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  const patterns = [];
  
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate)
  );

  let streakStart = null;
  let currentStreak = [];
  
  for (let i = 0; i < sortedTrades.length; i++) {
    const trade = sortedTrades[i];
    
    if (trade.result === 'loss') {
      if (currentStreak.length === 0) {
        streakStart = trade;
      }
      currentStreak.push(trade);
    } else {
      if (currentStreak.length >= config.tiltStreakCount) {
        const firstTrade = currentStreak[0];
        const lastTrade = currentStreak[currentStreak.length - 1];
        const durationMinutes = (new Date(lastTrade.entryTime || lastTrade.tradeDate) - 
          new Date(firstTrade.entryTime || firstTrade.tradeDate)) / (1000 * 60);
        
        const totalLoss = currentStreak.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
        
        patterns.push({
          type: 'TILT_STREAK',
          severity: currentStreak.length >= config.tiltStreakCount * 1.5 ? 'high' : 'medium',
          streakLength: currentStreak.length,
          duration: durationMinutes < 60 
            ? `${Math.round(durationMinutes)} minutes`
            : `${(durationMinutes / 60).toFixed(1)} hours`,
          totalLoss,
          affectedTrades: currentStreak.map(t => t._id),
          startDate: firstTrade.entryTime || firstTrade.tradeDate,
          endDate: lastTrade.entryTime || lastTrade.tradeDate
        });
      }
      currentStreak = [];
    }
  }
  
  // Check final streak
  if (currentStreak.length >= config.tiltStreakCount) {
    const firstTrade = currentStreak[0];
    const lastTrade = currentStreak[currentStreak.length - 1];
    const durationMinutes = (new Date(lastTrade.entryTime || lastTrade.tradeDate) - 
      new Date(firstTrade.entryTime || firstTrade.tradeDate)) / (1000 * 60);
    const totalLoss = currentStreak.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    
    patterns.push({
      type: 'TILT_STREAK',
      severity: currentStreak.length >= config.tiltStreakCount * 1.5 ? 'high' : 'medium',
      streakLength: currentStreak.length,
      duration: durationMinutes < 60 
        ? `${Math.round(durationMinutes)} minutes`
        : `${(durationMinutes / 60).toFixed(1)} hours`,
      totalLoss,
      affectedTrades: currentStreak.map(t => t._id),
      startDate: firstTrade.entryTime || firstTrade.tradeDate,
      endDate: lastTrade.entryTime || lastTrade.tradeDate
    });
  }
  
  return patterns;
}

/**
 * 3. Detect Overtrading
 * Trade count significantly higher than baseline
 */
function detectOvertrading(trades, baseline) {
  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  const patterns = [];
  
  const byDay = groupTradesByDay(trades);
  const threshold = baseline.avgDailyTradeCount * config.overtradingMultiplier;
  
  Object.entries(byDay).forEach(([date, dayTrades]) => {
    if (dayTrades.length > threshold && baseline.avgDailyTradeCount > 0) {
      const dayWins = dayTrades.filter(t => t.result === 'win').length;
      const dayClosed = dayTrades.filter(t => t.result && t.result !== 'open').length;
      const dayWinRate = dayClosed > 0 ? (dayWins / dayClosed) * 100 : 0;
      const dayPnL = dayTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
      
      patterns.push({
        type: 'OVERTRADING',
        severity: dayTrades.length > threshold * 1.5 ? 'high' : 'medium',
        date,
        tradeCount: dayTrades.length,
        baseline: Math.round(baseline.avgDailyTradeCount),
        multiplier: (dayTrades.length / baseline.avgDailyTradeCount).toFixed(1) + 'x',
        dayWinRate: dayWinRate.toFixed(1) + '%',
        baselineWinRate: baseline.baselineWinRate.toFixed(1) + '%',
        dayPnL,
        affectedTrades: dayTrades.map(t => t._id)
      });
    }
  });
  
  return patterns;
}

/**
 * 4. Detect Rapid Fire Trading
 * Multiple trades in very short window
 */
function detectRapidFire(trades, baseline) {
  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  const patterns = [];
  
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate)
  );

  for (let i = 0; i < sortedTrades.length - 2; i++) {
    const windowTrades = [sortedTrades[i]];
    const windowStart = new Date(sortedTrades[i].entryTime || sortedTrades[i].tradeDate);
    
    for (let j = i + 1; j < sortedTrades.length; j++) {
      const tradeTime = new Date(sortedTrades[j].entryTime || sortedTrades[j].tradeDate);
      const minutesDiff = (tradeTime - windowStart) / (1000 * 60);
      
      if (minutesDiff <= config.rapidFireMinutes) {
        windowTrades.push(sortedTrades[j]);
      } else {
        break;
      }
    }
    
    if (windowTrades.length >= 3) {
      const windowPnL = windowTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
      const windowWins = windowTrades.filter(t => t.result === 'win').length;
      
      patterns.push({
        type: 'RAPID_FIRE',
        severity: windowTrades.length >= 5 ? 'high' : 'medium',
        tradeCount: windowTrades.length,
        windowMinutes: config.rapidFireMinutes,
        startTime: windowStart,
        totalPnL: windowPnL,
        winCount: windowWins,
        lossCount: windowTrades.length - windowWins,
        affectedTrades: windowTrades.map(t => t._id)
      });
      
      i += windowTrades.length - 1; // Skip processed trades
    }
  }
  
  return patterns;
}

/**
 * 5. Detect Position Size Drift (Up - Overconfidence)
 */
function detectPositionSizeDriftUp(trades, baseline) {
  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  const patterns = [];
  
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate)
  );

  for (let i = 3; i < sortedTrades.length; i++) {
    const recentTrades = sortedTrades.slice(i - 3, i);
    const currentTrade = sortedTrades[i];
    
    const recentWins = recentTrades.filter(t => t.result === 'win').length;
    
    if (recentWins >= 2) {
      const currentSize = currentTrade.positionValue || (currentTrade.entryPrice * currentTrade.quantity);
      const deviation = baseline.avgPositionSize > 0 
        ? (currentSize - baseline.avgPositionSize) / baseline.avgPositionSize 
        : 0;
      
      if (deviation > config.sizeDeviationThreshold) {
        patterns.push({
          type: 'POSITION_SIZE_DRIFT_UP',
          severity: deviation > config.sizeDeviationThreshold * 2 ? 'high' : 'medium',
          trade: currentTrade._id,
          positionSize: currentSize,
          baselineSize: baseline.avgPositionSize,
          deviation: (deviation * 100).toFixed(1) + '%',
          context: 'after_win_streak',
          recentWins,
          outcome: currentTrade.result,
          pnlImpact: currentTrade.profitLoss || 0
        });
      }
    }
  }
  
  return patterns;
}

/**
 * 6. Detect Position Size Drift (Down - Fear after losses)
 */
function detectPositionSizeDriftDown(trades, baseline) {
  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  const patterns = [];
  
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate)
  );

  for (let i = 2; i < sortedTrades.length; i++) {
    const recentTrades = sortedTrades.slice(i - 2, i);
    const currentTrade = sortedTrades[i];
    
    const recentLosses = recentTrades.filter(t => t.result === 'loss').length;
    
    if (recentLosses >= 2) {
      const currentSize = currentTrade.positionValue || (currentTrade.entryPrice * currentTrade.quantity);
      const deviation = baseline.avgPositionSize > 0 
        ? (baseline.avgPositionSize - currentSize) / baseline.avgPositionSize 
        : 0;
      
      if (deviation > config.sizeDeviationThreshold * 0.8) {
        patterns.push({
          type: 'POSITION_SIZE_DRIFT_DOWN',
          severity: deviation > config.sizeDeviationThreshold * 1.5 ? 'high' : 'medium',
          trade: currentTrade._id,
          positionSize: currentSize,
          baselineSize: baseline.avgPositionSize,
          deviation: (-deviation * 100).toFixed(1) + '%',
          context: 'after_loss_streak',
          recentLosses,
          outcome: currentTrade.result,
          pnlImpact: currentTrade.profitLoss || 0,
          insight: currentTrade.result === 'win' 
            ? 'This winning trade had reduced size - missed potential profit'
            : null
        });
      }
    }
  }
  
  return patterns;
}

/**
 * 7. Detect Position Size Chaos
 * High variance in position sizing
 */
function detectPositionSizeChaos(trades, baseline) {
  const patterns = [];
  
  if (trades.length < 7) return patterns;
  
  const sizes = trades.map(t => t.positionValue || (t.entryPrice * t.quantity));
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const stdDev = calculateStdDev(sizes);
  
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
  
  if (coefficientOfVariation > 0.8) {
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    
    patterns.push({
      type: 'POSITION_SIZE_CHAOS',
      severity: coefficientOfVariation > 1.2 ? 'high' : 'medium',
      coefficientOfVariation: (coefficientOfVariation * 100).toFixed(1) + '%',
      meanSize: mean.toFixed(2),
      stdDev: stdDev.toFixed(2),
      minSize: minSize.toFixed(2),
      maxSize: maxSize.toFixed(2),
      range: ((maxSize - minSize) / mean * 100).toFixed(1) + '%',
      tradeCount: trades.length,
      insight: 'Inconsistent position sizing makes risk management difficult'
    });
  }
  
  return patterns;
}

/**
 * 8. Detect Time of Day Bias
 */
function detectTimeOfDayBias(trades, baseline) {
  const patterns = [];
  
  if (!baseline.hourlyPerformance || baseline.hourlyPerformance.length < 3) {
    return patterns;
  }

  const avgWinRate = baseline.baselineWinRate;
  
  baseline.hourlyPerformance.forEach(hourData => {
    if (hourData.tradeCount >= 5) {
      const deviation = hourData.winRate - avgWinRate;
      
      if (Math.abs(deviation) > 20) {
        patterns.push({
          type: deviation < 0 ? 'TIME_OF_DAY_BIAS_NEGATIVE' : 'TIME_OF_DAY_BIAS_POSITIVE',
          severity: Math.abs(deviation) > 30 ? 'high' : 'medium',
          hour: hourData.hour,
          hourLabel: `${hourData.hour}:00 - ${hourData.hour + 1}:00`,
          tradeCount: hourData.tradeCount,
          hourWinRate: hourData.winRate.toFixed(1) + '%',
          baselineWinRate: avgWinRate.toFixed(1) + '%',
          deviation: (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%',
          totalPnL: hourData.totalPnL,
          insight: deviation < 0 
            ? `Avoid trading at ${hourData.hour}:00 - your win rate drops significantly`
            : `${hourData.hour}:00 is your best performing hour`
        });
      }
    }
  });
  
  return patterns;
}

/**
 * 9. Detect Day of Week Bias
 */
function detectDayOfWeekBias(trades, baseline) {
  const patterns = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  if (!baseline.dailyPerformance || baseline.dailyPerformance.length < 3) {
    return patterns;
  }

  const avgWinRate = baseline.baselineWinRate;
  
  baseline.dailyPerformance.forEach(dayData => {
    if (dayData.tradeCount >= 5) {
      const deviation = dayData.winRate - avgWinRate;
      
      if (Math.abs(deviation) > 20) {
        patterns.push({
          type: deviation < 0 ? 'DAY_OF_WEEK_BIAS_NEGATIVE' : 'DAY_OF_WEEK_BIAS_POSITIVE',
          severity: Math.abs(deviation) > 30 ? 'high' : 'medium',
          dayOfWeek: dayData.dayOfWeek,
          dayName: dayNames[dayData.dayOfWeek],
          tradeCount: dayData.tradeCount,
          dayWinRate: dayData.winRate.toFixed(1) + '%',
          baselineWinRate: avgWinRate.toFixed(1) + '%',
          deviation: (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%',
          totalPnL: dayData.totalPnL,
          insight: deviation < 0 
            ? `Consider reducing trading on ${dayNames[dayData.dayOfWeek]}s`
            : `${dayNames[dayData.dayOfWeek]} is your best performing day`
        });
      }
    }
  });
  
  return patterns;
}

/**
 * 10. Detect Symbol Loss Clustering
 */
function detectSymbolClustering(trades, baseline) {
  const patterns = [];
  
  if (!baseline.symbolPerformance) return patterns;
  
  baseline.symbolPerformance.forEach(symbolData => {
    if (symbolData.tradeCount >= 5 && symbolData.winRate < 35) {
      patterns.push({
        type: 'SYMBOL_LOSS_CLUSTERING',
        severity: symbolData.winRate < 25 ? 'high' : 'medium',
        symbol: symbolData.symbol,
        tradeCount: symbolData.tradeCount,
        winRate: symbolData.winRate.toFixed(1) + '%',
        totalPnL: symbolData.totalPnL,
        baselineWinRate: baseline.baselineWinRate.toFixed(1) + '%',
        insight: `Consider avoiding ${symbolData.symbol} - consistent underperformance`
      });
    }
  });
  
  return patterns;
}

/**
 * 11. Detect First Trade Syndrome
 */
function detectFirstTradeSyndrome(trades, baseline) {
  const patterns = [];
  const byDay = groupTradesByDay(trades);
  
  const firstTrades = Object.values(byDay)
    .map(dayTrades => {
      const sorted = dayTrades.sort((a, b) => 
        new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate)
      );
      return sorted[0];
    })
    .filter(t => t && t.result && t.result !== 'open');
  
  if (firstTrades.length < 5) return patterns;
  
  const firstTradeWins = firstTrades.filter(t => t.result === 'win').length;
  const firstTradeWinRate = (firstTradeWins / firstTrades.length) * 100;
  const firstTradePnL = firstTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  if (firstTradeWinRate < baseline.baselineWinRate - 15) {
    patterns.push({
      type: 'FIRST_TRADE_SYNDROME',
      severity: firstTradeWinRate < baseline.baselineWinRate - 25 ? 'high' : 'medium',
      firstTradeCount: firstTrades.length,
      firstTradeWinRate: firstTradeWinRate.toFixed(1) + '%',
      baselineWinRate: baseline.baselineWinRate.toFixed(1) + '%',
      deviation: (firstTradeWinRate - baseline.baselineWinRate).toFixed(1) + '%',
      totalPnL: firstTradePnL,
      insight: 'Your first trade of the day underperforms - consider waiting or paper trading first'
    });
  }
  
  return patterns;
}

/**
 * 12. Detect Loss Aversion (holding losers longer than winners)
 */
function detectLossAversion(trades, baseline) {
  const patterns = [];
  
  const tradesWithDuration = trades.filter(t => 
    t.entryTime && t.exitTime && t.result && t.result !== 'open'
  );
  
  if (tradesWithDuration.length < 10) return patterns;
  
  const winners = tradesWithDuration.filter(t => t.result === 'win');
  const losers = tradesWithDuration.filter(t => t.result === 'loss');
  
  if (winners.length < 3 || losers.length < 3) return patterns;
  
  const avgWinHold = winners.reduce((sum, t) => 
    sum + (new Date(t.exitTime) - new Date(t.entryTime)) / (1000 * 60), 0
  ) / winners.length;
  
  const avgLossHold = losers.reduce((sum, t) => 
    sum + (new Date(t.exitTime) - new Date(t.entryTime)) / (1000 * 60), 0
  ) / losers.length;
  
  const holdRatio = avgLossHold / avgWinHold;
  
  if (holdRatio > 1.5) {
    patterns.push({
      type: 'LOSS_AVERSION',
      severity: holdRatio > 2.5 ? 'high' : 'medium',
      avgWinHoldMinutes: Math.round(avgWinHold),
      avgLossHoldMinutes: Math.round(avgLossHold),
      holdRatio: holdRatio.toFixed(2) + 'x',
      winnerCount: winners.length,
      loserCount: losers.length,
      insight: 'You hold losing trades longer than winners - cut losses faster',
      recommendation: `Target hold time for losers: ${Math.round(avgWinHold * 1.2)} minutes max`
    });
  }
  
  return patterns;
}

/**
 * 13. Detect Negative Emotion Trading
 */
function detectNegativeEmotionTrading(trades, baseline) {
  const patterns = [];
  
  const tradesWithEmotion = trades.filter(t => 
    t.emotionAnalysis?.detected && t.result && t.result !== 'open'
  );
  
  if (tradesWithEmotion.length < 10) return patterns;
  
  const negativeEmotionTrades = tradesWithEmotion.filter(t => 
    t.emotionAnalysis.detected === 'negative'
  );
  
  if (negativeEmotionTrades.length < 3) return patterns;
  
  const negativeWins = negativeEmotionTrades.filter(t => t.result === 'win').length;
  const negativeWinRate = (negativeWins / negativeEmotionTrades.length) * 100;
  const negativePnL = negativeEmotionTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  const neutralTrades = tradesWithEmotion.filter(t => 
    t.emotionAnalysis.detected === 'neutral'
  );
  const neutralWins = neutralTrades.filter(t => t.result === 'win').length;
  const neutralWinRate = neutralTrades.length > 0 
    ? (neutralWins / neutralTrades.length) * 100 
    : baseline.baselineWinRate;
  
  if (negativeWinRate < neutralWinRate - 10) {
    patterns.push({
      type: 'NEGATIVE_EMOTION_TRADING',
      severity: negativeWinRate < neutralWinRate - 20 ? 'high' : 'medium',
      negativeEmotionTrades: negativeEmotionTrades.length,
      negativeWinRate: negativeWinRate.toFixed(1) + '%',
      neutralWinRate: neutralWinRate.toFixed(1) + '%',
      deviation: (negativeWinRate - neutralWinRate).toFixed(1) + '%',
      totalPnL: negativePnL,
      affectedTrades: negativeEmotionTrades.map(t => t._id),
      insight: 'Trades entered with negative emotions significantly underperform',
      recommendation: 'Wait for emotional neutrality before entering trades'
    });
  }
  
  return patterns;
}

/**
 * 14. Detect FOMO Entry
 */
function detectFOMOEntry(trades, baseline) {
  const patterns = [];
  const fomoKeywords = ['fomo', 'fear of missing', 'chasing', 'late entry', 'missed', 'catching up', 
    'everyone buying', 'don\'t want to miss', 'jumping in', 'quick profit'];
  
  const fomoTrades = trades.filter(t => {
    if (!t.reason) return false;
    const reasonLower = t.reason.toLowerCase();
    return fomoKeywords.some(keyword => reasonLower.includes(keyword));
  });
  
  if (fomoTrades.length < 3) return patterns;
  
  const fomoClosedTrades = fomoTrades.filter(t => t.result && t.result !== 'open');
  if (fomoClosedTrades.length < 3) return patterns;
  
  const fomoWins = fomoClosedTrades.filter(t => t.result === 'win').length;
  const fomoWinRate = (fomoWins / fomoClosedTrades.length) * 100;
  const fomoPnL = fomoClosedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  patterns.push({
    type: 'FOMO_ENTRY',
    severity: fomoWinRate < baseline.baselineWinRate - 15 ? 'high' : 'medium',
    fomoTradeCount: fomoClosedTrades.length,
    fomoWinRate: fomoWinRate.toFixed(1) + '%',
    baselineWinRate: baseline.baselineWinRate.toFixed(1) + '%',
    totalPnL: fomoPnL,
    affectedTrades: fomoTrades.map(t => t._id),
    detectedKeywords: fomoKeywords.filter(k => 
      fomoTrades.some(t => t.reason?.toLowerCase().includes(k))
    ),
    insight: 'FOMO trades detected in your journal - these often underperform',
    recommendation: 'Wait for pullbacks instead of chasing moves'
  });
  
  return patterns;
}

/**
 * 15. Detect Stop Loss Violations
 */
function detectStopLossViolations(trades, baseline) {
  const patterns = [];
  
  const tradesWithSL = trades.filter(t => 
    t.stopLoss && t.exitPrice && t.result === 'loss' && t.direction
  );
  
  const violations = tradesWithSL.filter(t => {
    if (t.direction === 'long') {
      return t.exitPrice < t.stopLoss;
    } else {
      return t.exitPrice > t.stopLoss;
    }
  });
  
  if (violations.length >= 2) {
    const totalExcessLoss = violations.reduce((sum, t) => {
      const plannedLoss = Math.abs(t.entryPrice - t.stopLoss) * t.quantity;
      const actualLoss = Math.abs(t.profitLoss || 0);
      return sum + (actualLoss - plannedLoss);
    }, 0);
    
    patterns.push({
      type: 'STOP_LOSS_VIOLATION',
      severity: violations.length >= 5 ? 'high' : 'medium',
      violationCount: violations.length,
      totalTradesWithSL: tradesWithSL.length,
      violationRate: ((violations.length / tradesWithSL.length) * 100).toFixed(1) + '%',
      excessLoss: totalExcessLoss,
      affectedTrades: violations.map(t => t._id),
      insight: 'You are not respecting your stop losses - this increases losses significantly',
      recommendation: 'Use hard stops or alerts to enforce stop loss discipline'
    });
  }
  
  return patterns;
}

// ============================================
// POSITIVE PATTERNS
// ============================================

function detectPositivePatterns(trades, baseline) {
  const positivePatterns = [];
  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  
  // 1. Consistent Sizing
  const sizes = trades.map(t => t.positionValue || (t.entryPrice * t.quantity));
  if (sizes.length >= 10) {
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const stdDev = calculateStdDev(sizes);
    const cv = mean > 0 ? stdDev / mean : 0;
    
    if (cv < 0.3) {
      positivePatterns.push({
        type: 'CONSISTENT_SIZING',
        message: `Your position sizing has been consistent (±${(cv * 100).toFixed(0)}%) over ${trades.length} trades`
      });
    }
  }
  
  // 2. Stop Loss Discipline
  const tradesWithSL = trades.filter(t => t.stopLoss);
  if (tradesWithSL.length / trades.length > 0.8) {
    positivePatterns.push({
      type: 'STOP_LOSS_DISCIPLINE',
      message: `${((tradesWithSL.length / trades.length) * 100).toFixed(0)}% of your trades have stop losses set`
    });
  }
  
  // 3. Emotional Neutrality
  const tradesWithEmotion = trades.filter(t => t.emotionAnalysis?.detected);
  const neutralTrades = tradesWithEmotion.filter(t => t.emotionAnalysis.detected === 'neutral');
  if (tradesWithEmotion.length >= 10 && neutralTrades.length / tradesWithEmotion.length > 0.6) {
    positivePatterns.push({
      type: 'EMOTIONAL_NEUTRALITY',
      message: `${((neutralTrades.length / tradesWithEmotion.length) * 100).toFixed(0)}% of your trades are entered with neutral emotion`
    });
  }
  
  // 4. Recovery Patience
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryTime || a.tradeDate) - new Date(b.entryTime || b.tradeDate)
  );
  
  let patienceCount = 0;
  for (let i = 1; i < sortedTrades.length; i++) {
    if (sortedTrades[i - 1].result === 'loss') {
      const timeDiff = (new Date(sortedTrades[i].entryTime || sortedTrades[i].tradeDate) - 
        new Date(sortedTrades[i - 1].exitTime || sortedTrades[i - 1].tradeDate)) / (1000 * 60);
      if (timeDiff > config.revengeWindowMinutes) {
        patienceCount++;
      }
    }
  }
  
  const lossCount = trades.filter(t => t.result === 'loss').length;
  if (lossCount > 3 && patienceCount / lossCount > 0.7) {
    positivePatterns.push({
      type: 'RECOVERY_PATIENCE',
      message: `You wait appropriately after losses ${((patienceCount / lossCount) * 100).toFixed(0)}% of the time`
    });
  }
  
  return positivePatterns;
}

// ============================================
// COST ATTRIBUTION
// ============================================

function estimatePatternCost(pattern, trades, baseline) {
  let directCost = 0;
  let opportunityCost = 0;
  
  if (pattern.affectedTrades && Array.isArray(pattern.affectedTrades)) {
    const affectedTradeObjects = trades.filter(t => 
      pattern.affectedTrades.includes(t._id?.toString()) || 
      pattern.affectedTrades.includes(t._id)
    );
    
    directCost = affectedTradeObjects.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    
    const patternWinRate = affectedTradeObjects.filter(t => t.result === 'win').length / 
      affectedTradeObjects.filter(t => t.result && t.result !== 'open').length;
    
    if (baseline.baselineWinRate > patternWinRate * 100) {
      const expectedExtraWins = affectedTradeObjects.length * 
        ((baseline.baselineWinRate / 100) - patternWinRate);
      opportunityCost = expectedExtraWins * (baseline.avgWinAmount || 0);
    }
  } else if (pattern.totalPnL !== undefined) {
    directCost = pattern.totalPnL;
  } else if (pattern.pnlImpact !== undefined) {
    directCost = pattern.pnlImpact;
  }
  
  return {
    directCost: Math.round(directCost * 100) / 100,
    opportunityCost: Math.round(opportunityCost * 100) / 100,
    totalEstimatedCost: Math.round((directCost + opportunityCost) * 100) / 100
  };
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

async function analyzeAllPatterns(userId, periodDays = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: startDate }
  }).sort({ entryTime: 1, tradeDate: 1 });

  // Get or calculate baseline
  let baseline = await UserBaseline.findOne({ user: userId });
  if (!baseline || baseline.needsRecalculation(24)) {
    baseline = await calculateUserBaseline(userId, 90);
  }

  const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
  
  if (trades.length < config.minTradesForPattern) {
    return {
      success: true,
      message: `Need at least ${config.minTradesForPattern} trades for pattern analysis`,
      tradingStyle: baseline.tradingStyle,
      tradeCount: trades.length,
      patterns: [],
      positivePatterns: [],
      baseline: {
        tradingStyle: baseline.tradingStyle,
        avgDailyTradeCount: baseline.avgDailyTradeCount,
        baselineWinRate: baseline.baselineWinRate,
        avgPositionSize: baseline.avgPositionSize
      }
    };
  }

  // Run all pattern detectors
  const allPatterns = [
    ...detectRevengeTrading(trades, baseline),
    ...detectTiltStreak(trades, baseline),
    ...detectOvertrading(trades, baseline),
    ...detectRapidFire(trades, baseline),
    ...detectPositionSizeDriftUp(trades, baseline),
    ...detectPositionSizeDriftDown(trades, baseline),
    ...detectPositionSizeChaos(trades, baseline),
    ...detectTimeOfDayBias(trades, baseline),
    ...detectDayOfWeekBias(trades, baseline),
    ...detectSymbolClustering(trades, baseline),
    ...detectFirstTradeSyndrome(trades, baseline),
    ...detectLossAversion(trades, baseline),
    ...detectNegativeEmotionTrading(trades, baseline),
    ...detectFOMOEntry(trades, baseline),
    ...detectStopLossViolations(trades, baseline)
  ];

  // Add cost estimates
  const patternsWithCost = allPatterns.map(pattern => ({
    ...pattern,
    costEstimate: estimatePatternCost(pattern, trades, baseline)
  }));

  // Sort by severity and cost
  patternsWithCost.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return (b.costEstimate?.totalEstimatedCost || 0) - (a.costEstimate?.totalEstimatedCost || 0);
  });

  // Detect positive patterns
  const positivePatterns = detectPositivePatterns(trades, baseline);

  // Calculate behavioral score (0-100)
  const maxScore = 100;
  const deductions = patternsWithCost.reduce((sum, p) => {
    const severityDeduction = { high: 15, medium: 8, low: 3 };
    return sum + (severityDeduction[p.severity] || 5);
  }, 0);
  const bonuses = positivePatterns.length * 5;
  const behavioralScore = Math.max(0, Math.min(100, maxScore - deductions + bonuses));

  // Group patterns by type for summary
  const patternSummary = {};
  patternsWithCost.forEach(p => {
    const baseType = p.type.replace(/_POSITIVE|_NEGATIVE/, '');
    if (!patternSummary[baseType]) {
      patternSummary[baseType] = { count: 0, totalCost: 0 };
    }
    patternSummary[baseType].count++;
    patternSummary[baseType].totalCost += p.costEstimate?.directCost || 0;
  });

  return {
    success: true,
    behavioralScore,
    period: `${periodDays}d`,
    tradingStyle: baseline.tradingStyle,
    styleConfidence: baseline.styleConfidence,
    tradeCount: trades.length,
    patternsDetected: patternsWithCost,
    patternSummary,
    positivePatterns,
    baseline: {
      tradingStyle: baseline.tradingStyle,
      styleConfidence: baseline.styleConfidence,
      avgDailyTradeCount: Math.round(baseline.avgDailyTradeCount * 10) / 10,
      baselineWinRate: Math.round(baseline.baselineWinRate * 10) / 10,
      avgPositionSize: Math.round(baseline.avgPositionSize * 100) / 100,
      avgHoldDurationMinutes: Math.round(baseline.avgHoldDurationMinutes),
      bestPerformingHours: baseline.bestPerformingHours,
      worstPerformingHours: baseline.worstPerformingHours,
      calculatedAt: baseline.calculatedAt
    },
    recommendations: generateRecommendations(patternsWithCost, baseline)
  };
}

/**
 * Generate actionable recommendations based on detected patterns
 */
function generateRecommendations(patterns, baseline) {
  const recommendations = [];
  
  const patternTypes = new Set(patterns.map(p => p.type));
  
  if (patternTypes.has('REVENGE_TRADING')) {
    const config = STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN;
    recommendations.push({
      priority: 'high',
      category: 'discipline',
      recommendation: `After a loss, wait at least ${config.revengeWindowMinutes} minutes before your next trade`,
      basedOn: 'REVENGE_TRADING'
    });
  }
  
  if (patternTypes.has('TIME_OF_DAY_BIAS_NEGATIVE')) {
    const worstHours = baseline.worstPerformingHours || [];
    if (worstHours.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'timing',
        recommendation: `Consider avoiding trades during ${worstHours.map(h => `${h}:00`).join(', ')}`,
        basedOn: 'TIME_OF_DAY_BIAS'
      });
    }
  }
  
  if (patternTypes.has('POSITION_SIZE_DRIFT_UP') || patternTypes.has('POSITION_SIZE_CHAOS')) {
    recommendations.push({
      priority: 'medium',
      category: 'risk',
      recommendation: `Standardize position size to ₹${Math.round(baseline.avgPositionSize)} (±20%)`,
      basedOn: 'POSITION_SIZE'
    });
  }
  
  if (patternTypes.has('LOSS_AVERSION')) {
    recommendations.push({
      priority: 'high',
      category: 'trade_management',
      recommendation: 'Set time-based stops - exit losers within the same timeframe as winners',
      basedOn: 'LOSS_AVERSION'
    });
  }
  
  if (patternTypes.has('NEGATIVE_EMOTION_TRADING')) {
    recommendations.push({
      priority: 'high',
      category: 'psychology',
      recommendation: 'Do a 1-word emotional check before each trade. Skip if feeling anxious or fearful.',
      basedOn: 'NEGATIVE_EMOTION_TRADING'
    });
  }
  
  if (patternTypes.has('FIRST_TRADE_SYNDROME')) {
    recommendations.push({
      priority: 'medium',
      category: 'timing',
      recommendation: 'Paper trade or observe for 15-30 minutes before your first real trade',
      basedOn: 'FIRST_TRADE_SYNDROME'
    });
  }
  
  return recommendations;
}

module.exports = {
  calculateUserBaseline,
  detectTradingStyle,
  analyzeAllPatterns,
  
  // Individual pattern detectors (for testing/specific use)
  detectRevengeTrading,
  detectTiltStreak,
  detectOvertrading,
  detectRapidFire,
  detectPositionSizeDriftUp,
  detectPositionSizeDriftDown,
  detectPositionSizeChaos,
  detectTimeOfDayBias,
  detectDayOfWeekBias,
  detectSymbolClustering,
  detectFirstTradeSyndrome,
  detectLossAversion,
  detectNegativeEmotionTrading,
  detectFOMOEntry,
  detectStopLossViolations,
  detectPositivePatterns,
  
  // Utilities
  estimatePatternCost,
  STYLE_CONFIG
};
