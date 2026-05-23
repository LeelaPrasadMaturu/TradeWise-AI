/**
 * Trading Coach Service
 * Provides real-time alerts and pre-market briefings to help traders stay disciplined
 */

const Trade = require('../models/Trade');
const UserBaseline = require('../models/UserBaseline');
const TradingRule = require('../models/TradingRule');
const TradeRuleCheck = require('../models/TradeRuleCheck');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

const ALERT_TYPES = {
  TRADE_COUNT: 'TRADE_COUNT',
  LOSS_STREAK: 'LOSS_STREAK',
  BAD_HOUR: 'BAD_HOUR',
  REVENGE_RISK: 'REVENGE_RISK',
  TILT_WARNING: 'TILT_WARNING',
  POSITION_SIZE: 'POSITION_SIZE',
  WINNING_STREAK: 'WINNING_STREAK'
};

const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Get today's trading context for a user
 */
async function getTodayContext(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: today }
  }).sort({ entryTime: -1, tradeDate: -1 });
  
  const closedTrades = trades.filter(t => t.result && t.result !== 'open');
  
  return {
    trades,
    tradeCount: trades.length,
    closedCount: closedTrades.length,
    wins: closedTrades.filter(t => t.result === 'win').length,
    losses: closedTrades.filter(t => t.result === 'loss').length,
    todayPnL: trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0),
    lastTrade: trades[0] || null
  };
}

/**
 * Get recent consecutive results
 */
async function getRecentResults(userId, limit = 10) {
  const trades = await Trade.find({
    user: userId,
    result: { $in: ['win', 'loss'] }
  }).sort({ entryTime: -1, tradeDate: -1 }).limit(limit);
  
  let consecutiveLosses = 0;
  let consecutiveWins = 0;
  
  for (const trade of trades) {
    if (trade.result === 'loss') {
      if (consecutiveWins === 0) consecutiveLosses++;
      else break;
    } else if (trade.result === 'win') {
      if (consecutiveLosses === 0) consecutiveWins++;
      else break;
    }
  }
  
  return { consecutiveLosses, consecutiveWins, recentTrades: trades };
}

/**
 * Check if user is exceeding optimal trade count
 */
async function checkTradeCountAlert(userId) {
  const baseline = await UserBaseline.findOne({ user: userId });
  const context = await getTodayContext(userId);
  
  if (!baseline || baseline.basedOnTradeCount < 20) {
    return null;
  }
  
  const optimalCount = Math.ceil(baseline.avgDailyTradeCount);
  
  if (context.tradeCount > optimalCount) {
    // Calculate historical win rate after optimal trade count
    const trades = await Trade.find({
      user: userId,
      result: { $in: ['win', 'loss'] }
    }).sort({ tradeDate: -1 }).limit(500);
    
    // Group by day and find trades beyond optimal
    const tradesByDay = {};
    trades.forEach(t => {
      const day = t.tradeDate.toISOString().split('T')[0];
      if (!tradesByDay[day]) tradesByDay[day] = [];
      tradesByDay[day].push(t);
    });
    
    let beyondOptimalWins = 0;
    let beyondOptimalTotal = 0;
    
    Object.values(tradesByDay).forEach(dayTrades => {
      dayTrades.slice(optimalCount).forEach(t => {
        beyondOptimalTotal++;
        if (t.result === 'win') beyondOptimalWins++;
      });
    });
    
    const beyondOptimalWinRate = beyondOptimalTotal > 0 
      ? Math.round((beyondOptimalWins / beyondOptimalTotal) * 100) 
      : null;
    
    return {
      type: ALERT_TYPES.TRADE_COUNT,
      severity: context.tradeCount > optimalCount + 2 ? SEVERITY.HIGH : SEVERITY.WARNING,
      message: `You've taken ${context.tradeCount} trades today. Your win rate drops after trade #${optimalCount}${beyondOptimalWinRate !== null ? ` (${beyondOptimalWinRate}% vs ${Math.round(baseline.baselineWinRate)}% normal)` : ''}.`,
      data: {
        currentCount: context.tradeCount,
        optimalCount,
        beyondOptimalWinRate,
        normalWinRate: Math.round(baseline.baselineWinRate)
      }
    };
  }
  
  return null;
}

/**
 * Check for loss streak and suggest a break
 */
async function checkLossStreakAlert(userId) {
  const { consecutiveLosses } = await getRecentResults(userId);
  const context = await getTodayContext(userId);
  
  if (consecutiveLosses >= 2) {
    // Get historical performance after loss streaks
    const baseline = await UserBaseline.findOne({ user: userId });
    
    let severity = SEVERITY.WARNING;
    let message = `Last ${consecutiveLosses} trades were losses. Consider taking a break.`;
    
    if (consecutiveLosses >= 3) {
      severity = SEVERITY.HIGH;
      message = `${consecutiveLosses} consecutive losses. Strong recommendation: Take a 30-minute break.`;
    }
    
    if (consecutiveLosses >= 4) {
      severity = SEVERITY.CRITICAL;
      message = `Tilt alert! ${consecutiveLosses} consecutive losses. Stop trading for today.`;
    }
    
    return {
      type: consecutiveLosses >= 4 ? ALERT_TYPES.TILT_WARNING : ALERT_TYPES.LOSS_STREAK,
      severity,
      message,
      data: {
        consecutiveLosses,
        todayLosses: context.losses,
        todayPnL: context.todayPnL
      }
    };
  }
  
  return null;
}

/**
 * Check if trading during historically poor hours
 */
async function checkTimeOfDayAlert(userId, tradeTime = new Date()) {
  const baseline = await UserBaseline.findOne({ user: userId });
  
  if (!baseline || !baseline.hourlyPerformance || baseline.hourlyPerformance.length === 0) {
    return null;
  }
  
  const currentHour = tradeTime.getHours();
  const hourData = baseline.hourlyPerformance.find(h => h.hour === currentHour);
  
  if (!hourData || hourData.trades < 5) {
    return null;
  }
  
  // Find best hours
  const bestHours = baseline.hourlyPerformance
    .filter(h => h.trades >= 5)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3);
  
  const avgWinRate = baseline.baselineWinRate || 50;
  
  // Alert if current hour is significantly worse than average
  if (hourData.winRate < avgWinRate - 15) {
    const bestHoursStr = bestHours.map(h => `${h.hour}:00`).join(', ');
    
    return {
      type: ALERT_TYPES.BAD_HOUR,
      severity: hourData.winRate < avgWinRate - 25 ? SEVERITY.HIGH : SEVERITY.WARNING,
      message: `You're trading at ${currentHour}:00 (${Math.round(hourData.winRate)}% win rate). Your best hours are ${bestHoursStr}.`,
      data: {
        currentHour,
        currentHourWinRate: Math.round(hourData.winRate),
        avgWinRate: Math.round(avgWinRate),
        bestHours: bestHours.map(h => ({ hour: h.hour, winRate: Math.round(h.winRate) }))
      }
    };
  }
  
  return null;
}

/**
 * Check for revenge trading risk
 */
async function checkRevengeRiskAlert(userId) {
  const context = await getTodayContext(userId);
  
  if (!context.lastTrade || context.trades.length < 2) {
    return null;
  }
  
  const lastTrade = context.lastTrade;
  const previousTrade = context.trades[1];
  
  if (previousTrade.result !== 'loss') {
    return null;
  }
  
  const timeDiff = lastTrade.entryTime && previousTrade.exitTime
    ? (new Date(lastTrade.entryTime) - new Date(previousTrade.exitTime)) / (1000 * 60)
    : null;
  
  const baseline = await UserBaseline.findOne({ user: userId });
  const styleConfig = baseline?.getStyleConfig() || { revengeWindowMinutes: 30 };
  
  // Check if trade was entered quickly after a loss
  if (timeDiff !== null && timeDiff < styleConfig.revengeWindowMinutes) {
    // Check if position size increased
    const prevSize = previousTrade.positionValue || (previousTrade.entryPrice * previousTrade.quantity);
    const currSize = lastTrade.positionValue || (lastTrade.entryPrice * lastTrade.quantity);
    const sizeIncrease = prevSize > 0 ? ((currSize - prevSize) / prevSize) * 100 : 0;
    
    if (sizeIncrease > 20) {
      return {
        type: ALERT_TYPES.REVENGE_RISK,
        severity: SEVERITY.HIGH,
        message: `Potential revenge trade detected. You entered ${Math.round(timeDiff)} min after a loss with ${Math.round(sizeIncrease)}% larger position.`,
        data: {
          minutesSinceLoss: Math.round(timeDiff),
          positionSizeIncrease: Math.round(sizeIncrease),
          recommendedWait: styleConfig.revengeWindowMinutes
        }
      };
    }
  }
  
  return null;
}

/**
 * Check for unusual position sizing
 */
async function checkPositionSizeAlert(trade, userId) {
  const baseline = await UserBaseline.findOne({ user: userId });
  
  if (!baseline || !baseline.avgPositionSize || baseline.avgPositionSize === 0) {
    return null;
  }
  
  const tradeSize = trade.positionValue || (trade.entryPrice * trade.quantity);
  const deviation = ((tradeSize - baseline.avgPositionSize) / baseline.avgPositionSize) * 100;
  
  if (Math.abs(deviation) > 50) {
    const direction = deviation > 0 ? 'larger' : 'smaller';
    const { consecutiveWins, consecutiveLosses } = await getRecentResults(userId);
    
    let context = '';
    if (deviation > 0 && consecutiveWins >= 2) {
      context = ' This often happens after winning streaks (overconfidence).';
    } else if (deviation < 0 && consecutiveLosses >= 2) {
      context = ' This often happens after losses (fear).';
    }
    
    return {
      type: ALERT_TYPES.POSITION_SIZE,
      severity: Math.abs(deviation) > 100 ? SEVERITY.HIGH : SEVERITY.WARNING,
      message: `Position size is ${Math.round(Math.abs(deviation))}% ${direction} than your average.${context}`,
      data: {
        tradeSize,
        avgSize: baseline.avgPositionSize,
        deviation: Math.round(deviation),
        stdDev: baseline.positionSizeStdDev
      }
    };
  }
  
  return null;
}

/**
 * Generate all real-time alerts for a trade
 */
async function generateRealTimeAlerts(userId, trade = null) {
  const alerts = [];
  
  try {
    // Check trade count
    const tradeCountAlert = await checkTradeCountAlert(userId);
    if (tradeCountAlert) alerts.push(tradeCountAlert);
    
    // Check loss streak
    const lossStreakAlert = await checkLossStreakAlert(userId);
    if (lossStreakAlert) alerts.push(lossStreakAlert);
    
    // Check time of day
    const timeAlert = await checkTimeOfDayAlert(userId, trade?.entryTime || new Date());
    if (timeAlert) alerts.push(timeAlert);
    
    // Check revenge risk
    const revengeAlert = await checkRevengeRiskAlert(userId);
    if (revengeAlert) alerts.push(revengeAlert);
    
    // Check position size if trade provided
    if (trade) {
      const sizeAlert = await checkPositionSizeAlert(trade, userId);
      if (sizeAlert) alerts.push(sizeAlert);
    }
  } catch (error) {
    console.error('Error generating real-time alerts:', error);
  }
  
  // Sort by severity
  const severityOrder = { critical: 0, high: 1, warning: 2, info: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return alerts;
}

/**
 * Get yesterday's trading summary
 */
async function getYesterdaySummary(userId) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const trades = await Trade.find({
    user: userId,
    tradeDate: { $gte: yesterday, $lt: today }
  });
  
  const closedTrades = trades.filter(t => t.result && t.result !== 'open');
  const wins = closedTrades.filter(t => t.result === 'win').length;
  const losses = closedTrades.filter(t => t.result === 'loss').length;
  const pnl = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  // Get rule violations from yesterday
  const ruleChecks = await TradeRuleCheck.find({
    user: userId,
    checkedAt: { $gte: yesterday, $lt: today }
  });
  
  const violations = [];
  ruleChecks.forEach(check => {
    check.ruleResults.forEach(result => {
      if (!result.passed) {
        violations.push({
          ruleName: result.ruleName,
          ruleType: result.ruleType,
          message: result.message
        });
      }
    });
  });
  
  return {
    tradeCount: trades.length,
    wins,
    losses,
    winRate: closedTrades.length > 0 ? Math.round((wins / closedTrades.length) * 100) : 0,
    pnl,
    violations,
    blockedTrades: ruleChecks.filter(c => !c.tradeAllowed).length
  };
}

/**
 * Get day-of-week performance warning
 */
async function getDayOfWeekWarning(userId) {
  const baseline = await UserBaseline.findOne({ user: userId });
  
  if (!baseline || !baseline.dailyPerformance || baseline.dailyPerformance.length === 0) {
    return null;
  }
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const todayPerf = baseline.dailyPerformance.find(d => d.dayOfWeek === dayOfWeek);
  
  if (!todayPerf || todayPerf.trades < 5) {
    return null;
  }
  
  const avgWinRate = baseline.baselineWinRate || 50;
  
  if (todayPerf.winRate < avgWinRate - 10) {
    return {
      dayName: dayNames[dayOfWeek],
      winRate: Math.round(todayPerf.winRate),
      avgWinRate: Math.round(avgWinRate),
      trades: todayPerf.trades,
      warning: `You tend to struggle on ${dayNames[dayOfWeek]}s (${Math.round(todayPerf.winRate)}% win rate vs ${Math.round(avgWinRate)}% average). Stay cautious.`
    };
  }
  
  return null;
}

/**
 * Generate AI focus areas using Gemini
 */
async function generateAIFocusAreas(userId, yesterdaySummary, baseline) {
  if (!process.env.GOOGLE_AI_API_KEY) {
    return ['Focus on following your trading rules', 'Wait for A+ setups only'];
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `You are a trading coach. Based on this trader's data, provide 2-3 SHORT focus areas for today (max 15 words each).

Yesterday's Performance:
- Trades: ${yesterdaySummary.tradeCount}, Wins: ${yesterdaySummary.wins}, Losses: ${yesterdaySummary.losses}
- P&L: ₹${yesterdaySummary.pnl.toFixed(2)}
- Rule Violations: ${yesterdaySummary.violations.map(v => v.ruleName).join(', ') || 'None'}

Trader Profile:
- Trading Style: ${baseline?.tradingStyle || 'Unknown'}
- Baseline Win Rate: ${baseline?.baselineWinRate?.toFixed(1) || 'N/A'}%
- Avg Daily Trades: ${baseline?.avgDailyTradeCount?.toFixed(1) || 'N/A'}

Return ONLY a JSON array of strings, like: ["Focus area 1", "Focus area 2"]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return ['Follow your trading rules today', 'Wait for high-quality setups'];
  } catch (error) {
    console.error('Error generating AI focus areas:', error);
    return ['Focus on discipline today', 'Stick to your playbook'];
  }
}

/**
 * Generate pre-market briefing
 */
async function generatePreMarketBriefing(userId) {
  try {
    const [yesterdaySummary, baseline, dayWarning] = await Promise.all([
      getYesterdaySummary(userId),
      UserBaseline.findOne({ user: userId }),
      getDayOfWeekWarning(userId)
    ]);
    
    // Get best hours
    const bestHours = baseline?.hourlyPerformance
      ?.filter(h => h.trades >= 5)
      ?.sort((a, b) => b.winRate - a.winRate)
      ?.slice(0, 3)
      ?.map(h => ({ hour: h.hour, winRate: Math.round(h.winRate) })) || [];
    
    // Get AI-generated focus areas
    const focusAreas = await generateAIFocusAreas(userId, yesterdaySummary, baseline);
    
    // Build briefing
    const briefing = {
      generatedAt: new Date(),
      greeting: getGreeting(),
      
      yesterdaySummary: {
        tradeCount: yesterdaySummary.tradeCount,
        wins: yesterdaySummary.wins,
        losses: yesterdaySummary.losses,
        winRate: yesterdaySummary.winRate,
        pnl: yesterdaySummary.pnl,
        pnlFormatted: `₹${yesterdaySummary.pnl >= 0 ? '+' : ''}${yesterdaySummary.pnl.toFixed(2)}`,
        message: yesterdaySummary.tradeCount === 0 
          ? 'No trades yesterday'
          : `${yesterdaySummary.wins}W/${yesterdaySummary.losses}L (${yesterdaySummary.winRate}% win rate)`
      },
      
      rulesViolated: yesterdaySummary.violations.length > 0 ? {
        count: yesterdaySummary.violations.length,
        rules: [...new Set(yesterdaySummary.violations.map(v => v.ruleName))],
        message: `You violated ${yesterdaySummary.violations.length} rule(s) yesterday: ${[...new Set(yesterdaySummary.violations.map(v => v.ruleName))].join(', ')}`
      } : null,
      
      dayOfWeekWarning: dayWarning,
      
      bestHours: bestHours.length > 0 ? {
        hours: bestHours,
        message: `Your best trading hours: ${bestHours.map(h => `${h.hour}:00 (${h.winRate}%)`).join(', ')}`
      } : null,
      
      focusAreas,
      
      tradingStyle: baseline?.tradingStyle || 'UNKNOWN',
      
      motivationalMessage: getMotivationalMessage(yesterdaySummary)
    };
    
    return briefing;
  } catch (error) {
    console.error('Error generating pre-market briefing:', error);
    throw error;
  }
}

/**
 * Get greeting based on time
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get motivational message based on yesterday's performance
 */
function getMotivationalMessage(yesterdaySummary) {
  if (yesterdaySummary.tradeCount === 0) {
    return "Fresh start today. Trade with discipline.";
  }
  
  if (yesterdaySummary.winRate >= 60) {
    return "Great performance yesterday! Stay disciplined and don't get overconfident.";
  }
  
  if (yesterdaySummary.winRate >= 40) {
    return "Solid day yesterday. Focus on quality setups today.";
  }
  
  if (yesterdaySummary.losses > yesterdaySummary.wins) {
    return "Tough day yesterday. Today is a fresh start. Stick to your rules.";
  }
  
  return "New day, new opportunities. Trade your plan.";
}

/**
 * Format briefing as email HTML
 */
function formatBriefingAsEmail(briefing, userName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
    .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    .warning { border-left-color: #f59e0b; background: #fffbeb; }
    .success { border-left-color: #10b981; }
    .danger { border-left-color: #ef4444; background: #fef2f2; }
    .stat { display: inline-block; margin: 5px 10px 5px 0; padding: 5px 10px; background: #e5e7eb; border-radius: 4px; }
    .focus-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .focus-item:last-child { border-bottom: none; }
    h2 { margin: 0 0 10px 0; font-size: 16px; color: #374151; }
    .pnl-positive { color: #10b981; font-weight: bold; }
    .pnl-negative { color: #ef4444; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">${briefing.greeting}, ${userName}!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Pre-Market Briefing • ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
  </div>
  
  <div class="content">
    <div class="section ${briefing.yesterdaySummary.pnl >= 0 ? 'success' : 'danger'}">
      <h2>📊 Yesterday's Performance</h2>
      <p>${briefing.yesterdaySummary.message}</p>
      <span class="stat">P&L: <span class="${briefing.yesterdaySummary.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${briefing.yesterdaySummary.pnlFormatted}</span></span>
    </div>
    
    ${briefing.rulesViolated ? `
    <div class="section warning">
      <h2>⚠️ Rules Violated Yesterday</h2>
      <p>${briefing.rulesViolated.message}</p>
    </div>
    ` : ''}
    
    ${briefing.dayOfWeekWarning ? `
    <div class="section warning">
      <h2>📅 Day Warning</h2>
      <p>${briefing.dayOfWeekWarning.warning}</p>
    </div>
    ` : ''}
    
    ${briefing.bestHours ? `
    <div class="section">
      <h2>⏰ Your Best Hours</h2>
      <p>${briefing.bestHours.message}</p>
    </div>
    ` : ''}
    
    <div class="section">
      <h2>🎯 Focus Areas for Today</h2>
      ${briefing.focusAreas.map(f => `<div class="focus-item">• ${f}</div>`).join('')}
    </div>
    
    <div class="section" style="text-align: center; border-left-color: #8b5cf6;">
      <p style="font-style: italic; margin: 0;">"${briefing.motivationalMessage}"</p>
    </div>
  </div>
  
  <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
    TradeWise AI • Your Trading Coach
  </p>
</body>
</html>
`;
}

module.exports = {
  generateRealTimeAlerts,
  generatePreMarketBriefing,
  formatBriefingAsEmail,
  checkTradeCountAlert,
  checkLossStreakAlert,
  checkTimeOfDayAlert,
  checkRevengeRiskAlert,
  checkPositionSizeAlert,
  getYesterdaySummary,
  getDayOfWeekWarning,
  ALERT_TYPES,
  SEVERITY
};
