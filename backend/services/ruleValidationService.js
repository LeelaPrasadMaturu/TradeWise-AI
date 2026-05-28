/**
 * Rule Validation Service
 * Validates trades against user-defined trading rules
 */

const Trade = require('../models/Trade');
const TradingRule = require('../models/TradingRule');
const UserTradingConfig = require('../models/UserTradingConfig');
const TradeRuleCheck = require('../models/TradeRuleCheck');

/**
 * Get today's trading context for rule evaluation
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
    todayTrades: trades,
    todayTradeCount: trades.length,
    todayPnL: trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0),
    todayWins: closedTrades.filter(t => t.result === 'win').length,
    todayLosses: closedTrades.filter(t => t.result === 'loss').length,
    lastTrade: trades[0] || null
  };
}

/**
 * Get recent trades for pattern analysis
 */
async function getRecentContext(userId, minutes = 60) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  const recentTrades = await Trade.find({
    user: userId,
    entryTime: { $gte: since }
  }).sort({ entryTime: -1 });
  
  // Get consecutive losses
  const allRecentTrades = await Trade.find({
    user: userId
  }).sort({ entryTime: -1, tradeDate: -1 }).limit(20);
  
  let consecutiveLosses = 0;
  for (const trade of allRecentTrades) {
    if (trade.result === 'loss') {
      consecutiveLosses++;
    } else if (trade.result === 'win') {
      break;
    }
  }
  
  // Get open positions
  const openPositions = await Trade.countDocuments({
    user: userId,
    result: 'open'
  });
  
  return {
    recentTrades,
    recentTradeCount: recentTrades.length,
    consecutiveLosses,
    openPositions,
    lastTradeTime: allRecentTrades[0]?.exitTime || allRecentTrades[0]?.entryTime || null
  };
}

// ============================================
// RULE CHECKERS
// ============================================

/**
 * Check TIME_WINDOW rule
 */
function checkTimeWindow(rule, tradeData) {
  const { startHour, startMinute = 0, endHour, endMinute = 0 } = rule.params;
  
  const tradeTime = new Date(tradeData.entryTime || tradeData.tradeDate || Date.now());
  const tradeHour = tradeTime.getHours();
  const tradeMinutes = tradeTime.getMinutes();
  const tradeTotalMinutes = tradeHour * 60 + tradeMinutes;
  
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  
  const isWithinWindow = tradeTotalMinutes >= startTotalMinutes && tradeTotalMinutes <= endTotalMinutes;
  
  return {
    passed: isWithinWindow,
    message: isWithinWindow 
      ? `Trade is within allowed hours (${startHour}:${String(startMinute).padStart(2, '0')} - ${endHour}:${String(endMinute).padStart(2, '0')})`
      : `Trade at ${tradeHour}:${String(tradeMinutes).padStart(2, '0')} is outside allowed hours (${startHour}:${String(startMinute).padStart(2, '0')} - ${endHour}:${String(endMinute).padStart(2, '0')})`,
    details: {
      tradeTime: `${tradeHour}:${String(tradeMinutes).padStart(2, '0')}`,
      allowedWindow: `${startHour}:${String(startMinute).padStart(2, '0')} - ${endHour}:${String(endMinute).padStart(2, '0')}`
    }
  };
}

/**
 * Check MAX_DAILY_TRADES rule
 */
function checkMaxDailyTrades(rule, tradeData, context) {
  const { maxTrades } = rule.params;
  const currentCount = context.todayTradeCount;
  
  // This would be the Nth trade
  const newCount = currentCount + 1;
  const passed = newCount <= maxTrades;
  
  return {
    passed,
    message: passed
      ? `This is trade ${newCount} of ${maxTrades} allowed today`
      : `This would be trade ${newCount} today, exceeding your ${maxTrades} trade limit`,
    details: {
      currentCount,
      maxTrades,
      newCount
    }
  };
}

/**
 * Check MAX_POSITION_SIZE rule
 */
function checkMaxPositionSize(rule, tradeData, config) {
  const { maxSizeType, maxSizeValue } = rule.params;
  const positionValue = tradeData.positionValue || 
    (tradeData.entryPrice * tradeData.quantity);
  
  let maxAllowed;
  let passed;
  
  if (maxSizeType === 'percentage') {
    if (!config.tradingCapital || config.tradingCapital <= 0) {
      return {
        passed: true,
        message: 'Trading capital not set - cannot check percentage-based rule',
        details: { warning: 'Set your trading capital to enable this rule' }
      };
    }
    maxAllowed = (config.tradingCapital * maxSizeValue) / 100;
    passed = positionValue <= maxAllowed;
    
    return {
      passed,
      message: passed
        ? `Position size ₹${positionValue.toFixed(2)} is within ${maxSizeValue}% limit (₹${maxAllowed.toFixed(2)})`
        : `Position size ₹${positionValue.toFixed(2)} exceeds ${maxSizeValue}% of capital (max ₹${maxAllowed.toFixed(2)})`,
      details: {
        positionValue,
        maxAllowed,
        capitalPercentage: ((positionValue / config.tradingCapital) * 100).toFixed(2) + '%'
      }
    };
  } else {
    maxAllowed = maxSizeValue;
    passed = positionValue <= maxAllowed;
    
    return {
      passed,
      message: passed
        ? `Position size ₹${positionValue.toFixed(2)} is within ₹${maxAllowed} limit`
        : `Position size ₹${positionValue.toFixed(2)} exceeds ₹${maxAllowed} limit`,
      details: {
        positionValue,
        maxAllowed
      }
    };
  }
}

/**
 * Check MAX_DAILY_LOSS rule
 */
function checkMaxDailyLoss(rule, tradeData, context, config) {
  const { maxLossType, maxLossValue } = rule.params;
  const todayPnL = context.todayPnL;
  
  let maxLoss;
  
  if (maxLossType === 'percentage') {
    if (!config.tradingCapital || config.tradingCapital <= 0) {
      return {
        passed: true,
        message: 'Trading capital not set - cannot check percentage-based rule',
        details: { warning: 'Set your trading capital to enable this rule' }
      };
    }
    maxLoss = (config.tradingCapital * maxLossValue) / 100;
  } else {
    maxLoss = maxLossValue;
  }
  
  // Check if already exceeded
  const alreadyExceeded = todayPnL <= -maxLoss;
  
  return {
    passed: !alreadyExceeded,
    message: alreadyExceeded
      ? `Daily loss limit reached: ₹${Math.abs(todayPnL).toFixed(2)} lost today (limit: ₹${maxLoss.toFixed(2)})`
      : `Within daily loss limit: ₹${Math.abs(Math.min(0, todayPnL)).toFixed(2)} of ₹${maxLoss.toFixed(2)} used`,
    details: {
      todayPnL,
      maxLoss,
      remaining: Math.max(0, maxLoss + todayPnL)
    }
  };
}

/**
 * Check MIN_RISK_REWARD rule
 */
function checkMinRiskReward(rule, tradeData) {
  const { minRiskReward } = rule.params;
  
  if (!tradeData.stopLoss || !tradeData.takeProfit || !tradeData.entryPrice) {
    return {
      passed: false,
      message: 'Cannot calculate R:R - stop loss and take profit required',
      details: { warning: 'Set stop loss and take profit to check R:R' }
    };
  }
  
  const risk = Math.abs(tradeData.entryPrice - tradeData.stopLoss);
  const reward = Math.abs(tradeData.takeProfit - tradeData.entryPrice);
  const riskReward = risk > 0 ? reward / risk : 0;
  
  const passed = riskReward >= minRiskReward;
  
  return {
    passed,
    message: passed
      ? `Risk:Reward ratio ${riskReward.toFixed(2)} meets minimum ${minRiskReward}`
      : `Risk:Reward ratio ${riskReward.toFixed(2)} is below minimum ${minRiskReward}`,
    details: {
      riskReward: riskReward.toFixed(2),
      minRequired: minRiskReward,
      risk,
      reward
    }
  };
}

/**
 * Check REQUIRED_STOP_LOSS rule
 */
function checkRequiredStopLoss(rule, tradeData) {
  const hasStopLoss = tradeData.stopLoss !== undefined && tradeData.stopLoss !== null;
  
  return {
    passed: hasStopLoss,
    message: hasStopLoss
      ? `Stop loss set at ₹${tradeData.stopLoss}`
      : 'Stop loss is required but not set',
    details: {
      stopLoss: tradeData.stopLoss || 'Not set'
    }
  };
}

/**
 * Check REQUIRED_TAKE_PROFIT rule
 */
function checkRequiredTakeProfit(rule, tradeData) {
  const hasTakeProfit = tradeData.takeProfit !== undefined && tradeData.takeProfit !== null;
  
  return {
    passed: hasTakeProfit,
    message: hasTakeProfit
      ? `Take profit set at ₹${tradeData.takeProfit}`
      : 'Take profit is required but not set',
    details: {
      takeProfit: tradeData.takeProfit || 'Not set'
    }
  };
}

/**
 * Check ALLOWED_SYMBOLS rule
 */
function checkAllowedSymbols(rule, tradeData) {
  const { symbols } = rule.params;
  const tradeSymbol = (tradeData.symbol || '').toUpperCase();
  
  const isAllowed = symbols.map(s => s.toUpperCase()).includes(tradeSymbol);
  
  return {
    passed: isAllowed,
    message: isAllowed
      ? `${tradeSymbol} is in your allowed symbols list`
      : `${tradeSymbol} is not in your allowed symbols list: ${symbols.join(', ')}`,
    details: {
      symbol: tradeSymbol,
      allowedSymbols: symbols
    }
  };
}

/**
 * Check BLOCKED_SYMBOLS rule
 */
function checkBlockedSymbols(rule, tradeData) {
  const { symbols } = rule.params;
  const tradeSymbol = (tradeData.symbol || '').toUpperCase();
  
  const isBlocked = symbols.map(s => s.toUpperCase()).includes(tradeSymbol);
  
  return {
    passed: !isBlocked,
    message: isBlocked
      ? `${tradeSymbol} is in your blocked symbols list`
      : `${tradeSymbol} is not blocked`,
    details: {
      symbol: tradeSymbol,
      blockedSymbols: symbols
    }
  };
}

/**
 * Check MAX_CONSECUTIVE_LOSSES rule
 */
function checkMaxConsecutiveLosses(rule, tradeData, recentContext) {
  const { maxConsecutiveLosses } = rule.params;
  const currentStreak = recentContext.consecutiveLosses;
  
  const passed = currentStreak < maxConsecutiveLosses;
  
  return {
    passed,
    message: passed
      ? `Consecutive losses: ${currentStreak} (limit: ${maxConsecutiveLosses})`
      : `You have ${currentStreak} consecutive losses, which exceeds your ${maxConsecutiveLosses} limit. Take a break.`,
    details: {
      consecutiveLosses: currentStreak,
      maxAllowed: maxConsecutiveLosses
    }
  };
}

/**
 * Check COOLING_OFF_AFTER_LOSS rule
 */
function checkCoolingOff(rule, tradeData, recentContext) {
  const { coolingMinutes } = rule.params;
  
  if (recentContext.consecutiveLosses === 0) {
    return {
      passed: true,
      message: 'No recent losses - cooling off period not required',
      details: {}
    };
  }
  
  if (!recentContext.lastTradeTime) {
    return {
      passed: true,
      message: 'No recent trades found',
      details: {}
    };
  }
  
  const minutesSinceLastTrade = (Date.now() - new Date(recentContext.lastTradeTime)) / (1000 * 60);
  const passed = minutesSinceLastTrade >= coolingMinutes;
  
  return {
    passed,
    message: passed
      ? `${Math.round(minutesSinceLastTrade)} minutes since last trade (required: ${coolingMinutes} after loss)`
      : `Only ${Math.round(minutesSinceLastTrade)} minutes since your last loss. Wait ${Math.ceil(coolingMinutes - minutesSinceLastTrade)} more minutes.`,
    details: {
      minutesSinceLastTrade: Math.round(minutesSinceLastTrade),
      requiredMinutes: coolingMinutes,
      remainingMinutes: Math.max(0, Math.ceil(coolingMinutes - minutesSinceLastTrade))
    }
  };
}

/**
 * Check MAX_OPEN_POSITIONS rule
 */
function checkMaxOpenPositions(rule, tradeData, recentContext) {
  const { maxOpenPositions } = rule.params;
  const currentOpen = recentContext.openPositions;
  
  // This would add one more position
  const newTotal = currentOpen + 1;
  const passed = newTotal <= maxOpenPositions;
  
  return {
    passed,
    message: passed
      ? `Open positions: ${currentOpen} (limit: ${maxOpenPositions})`
      : `Already have ${currentOpen} open positions, max allowed is ${maxOpenPositions}`,
    details: {
      currentOpen,
      maxAllowed: maxOpenPositions
    }
  };
}

/**
 * Check REQUIRED_REASON rule
 */
function checkRequiredReason(rule, tradeData) {
  const hasReason = tradeData.reason && tradeData.reason.trim().length > 0;
  
  return {
    passed: hasReason,
    message: hasReason
      ? 'Trade reason provided'
      : 'A trade reason is required',
    details: {
      reasonProvided: hasReason
    }
  };
}

/**
 * Check a single rule against trade data
 */
async function checkSingleRule(rule, tradeData, todayContext, recentContext, config) {
  const { ruleType } = rule;
  
  let result;
  
  switch (ruleType) {
    case 'TIME_WINDOW':
      result = checkTimeWindow(rule, tradeData);
      break;
    case 'MAX_DAILY_TRADES':
      result = checkMaxDailyTrades(rule, tradeData, todayContext);
      break;
    case 'MAX_POSITION_SIZE':
      result = checkMaxPositionSize(rule, tradeData, config);
      break;
    case 'MAX_DAILY_LOSS':
      result = checkMaxDailyLoss(rule, tradeData, todayContext, config);
      break;
    case 'MIN_RISK_REWARD':
      result = checkMinRiskReward(rule, tradeData);
      break;
    case 'REQUIRED_STOP_LOSS':
      result = checkRequiredStopLoss(rule, tradeData);
      break;
    case 'REQUIRED_TAKE_PROFIT':
      result = checkRequiredTakeProfit(rule, tradeData);
      break;
    case 'ALLOWED_SYMBOLS':
      result = checkAllowedSymbols(rule, tradeData);
      break;
    case 'BLOCKED_SYMBOLS':
      result = checkBlockedSymbols(rule, tradeData);
      break;
    case 'MAX_CONSECUTIVE_LOSSES':
      result = checkMaxConsecutiveLosses(rule, tradeData, recentContext);
      break;
    case 'COOLING_OFF_AFTER_LOSS':
      result = checkCoolingOff(rule, tradeData, recentContext);
      break;
    case 'MAX_OPEN_POSITIONS':
      result = checkMaxOpenPositions(rule, tradeData, recentContext);
      break;
    case 'REQUIRED_REASON':
      result = checkRequiredReason(rule, tradeData);
      break;
    default:
      result = {
        passed: true,
        message: `Unknown rule type: ${ruleType}`,
        details: {}
      };
  }
  
  return {
    rule: rule._id,
    ruleName: rule.name,
    ruleType: rule.ruleType,
    passed: result.passed,
    action: rule.action,
    message: result.message,
    details: result.details
  };
}

/**
 * Check custom checklist items
 */
function checkCustomChecklist(config, checklistResponses = []) {
  const results = [];
  
  if (!config.customChecklistItems || config.customChecklistItems.length === 0) {
    return results;
  }
  
  const enabledItems = config.customChecklistItems.filter(item => item.enabled);
  
  for (const item of enabledItems) {
    const response = checklistResponses.find(r => 
      r.itemId === item._id.toString() || r.question === item.question
    );
    
    const answered = response !== undefined;
    const answeredYes = response?.response === true;
    
    let passed = true;
    if (item.required && !answeredYes) {
      passed = false;
    }
    
    results.push({
      itemId: item._id,
      question: item.question,
      response: response?.response,
      passed,
      action: item.action
    });
  }
  
  return results;
}

/**
 * Check emotional state
 */
function checkEmotionalState(config, emotion) {
  if (!config.requireEmotionalCheck) {
    return { passed: true, message: 'Emotional check not required' };
  }
  
  if (!emotion) {
    return { 
      passed: false, 
      message: 'Emotional state is required but not provided' 
    };
  }
  
  return config.isEmotionAllowed(emotion);
}

/**
 * Main validation function - validates a trade against all enabled rules
 */
async function validateTrade(userId, tradeData, options = {}) {
  const { 
    checklistResponses = [],
    preTradeEmotion = null,
    skipChecklist = false
  } = options;
  
  // Get config and rules
  const config = await UserTradingConfig.getOrCreate(userId);
  const rules = await TradingRule.getEnabledRules(userId);
  
  // Get context
  const todayContext = await getTodayContext(userId);
  const recentContext = await getRecentContext(userId, 120); // Last 2 hours
  
  // Check all rules
  const ruleResults = [];
  for (const rule of rules) {
    const result = await checkSingleRule(rule, tradeData, todayContext, recentContext, config);
    ruleResults.push(result);
    
    // Update rule stats
    await TradingRule.recordCheck(rule._id, result.passed);
  }
  
  // Check checklist if enabled
  let checklistResults = [];
  if (config.checklistEnabled && !skipChecklist) {
    checklistResults = checkCustomChecklist(config, checklistResponses);
  }
  
  // Check emotional state
  const emotionCheck = checkEmotionalState(config, preTradeEmotion);
  
  // Calculate summary
  const warnings = ruleResults.filter(r => !r.passed && r.action === 'warn');
  const blocks = ruleResults.filter(r => !r.passed && r.action === 'block');
  const checklistWarnings = checklistResults.filter(r => !r.passed && r.action === 'warn');
  const checklistBlocks = checklistResults.filter(r => !r.passed && r.action === 'block');
  
  // Determine if trade should be blocked
  const hasBlockingViolation = blocks.length > 0 || checklistBlocks.length > 0 || 
    (config.requireEmotionalCheck && !emotionCheck.passed);
  const blocked = config.blockOnFailure && hasBlockingViolation;
  
  // Calculate discipline score using severity-based weights (matches TradeRuleCheck.calculateScore)
  let deductions = 0;
  
  ruleResults.forEach(result => {
    if (!result.passed) {
      deductions += result.action === 'block' ? 25 : 15;
    }
  });
  
  checklistResults.forEach(result => {
    if (!result.passed) {
      deductions += result.action === 'block' ? 20 : 10;
    }
  });
  
  if (config.requireEmotionalCheck && !emotionCheck.passed) {
    deductions += 25;
  }
  
  const score = Math.max(0, Math.round(100 - deductions));
  
  // Get violated rule types
  const violations = ruleResults.filter(r => !r.passed).map(r => r.ruleType);
  
  return {
    allowed: !blocked,
    blocked,
    score,
    summary: {
      totalRules: ruleResults.length,
      passed: ruleResults.filter(r => r.passed).length,
      warnings: warnings.length,
      blocks: blocks.length,
      checklistItems: checklistResults.length,
      checklistPassed: checklistResults.filter(r => r.passed).length
    },
    ruleResults,
    checklistResults,
    emotionalState: preTradeEmotion,
    emotionPassed: emotionCheck.passed,
    emotionMessage: emotionCheck.message || emotionCheck.reason,
    warnings: [...warnings.map(w => w.message), ...checklistWarnings.map(c => c.question)],
    blockReasons: [...blocks.map(b => b.message), ...checklistBlocks.map(c => c.question)],
    violations,
    context: {
      todayTradeCount: todayContext.todayTradeCount,
      todayPnL: todayContext.todayPnL,
      consecutiveLosses: recentContext.consecutiveLosses,
      lastTradeTime: recentContext.lastTradeTime,
      openPositions: recentContext.openPositions
    }
  };
}

/**
 * Save validation result to database
 */
async function saveValidationResult(userId, validationResult, tradeData, tradeId = null) {
  const check = new TradeRuleCheck({
    user: userId,
    trade: tradeId,
    tradeAllowed: validationResult.allowed,
    ruleResults: validationResult.ruleResults,
    checklistResponses: validationResult.checklistResults,
    emotionalState: validationResult.emotionalState,
    emotionPassed: validationResult.emotionPassed,
    emotionMessage: validationResult.emotionMessage,
    context: validationResult.context,
    intendedTrade: !validationResult.allowed ? {
      symbol: tradeData.symbol,
      entryPrice: tradeData.entryPrice,
      quantity: tradeData.quantity,
      direction: tradeData.direction,
      stopLoss: tradeData.stopLoss,
      takeProfit: tradeData.takeProfit,
      reason: tradeData.reason,
      positionValue: tradeData.positionValue || (tradeData.entryPrice * tradeData.quantity)
    } : undefined
  });
  
  await check.save();
  
  // Update config stats
  const config = await UserTradingConfig.getOrCreate(userId);
  await config.recordCheck(
    validationResult.violations.length > 0,
    !validationResult.allowed
  );
  
  return check;
}

/**
 * Evaluate rules retroactively on existing trades
 * Called when rules are created, updated, or enabled
 * Creates/updates TradeRuleCheck documents for all trades
 */
async function evaluateRulesRetroactively(userId, options = {}) {
  const { 
    periodDays = 90,  // How far back to evaluate
    forceRecheck = false  // Re-evaluate even if trade already has a rule check
  } = options;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  // Get all trades in the period
  const query = {
    user: userId,
    tradeDate: { $gte: startDate }
  };
  
  // Optionally skip trades that already have rule checks
  if (!forceRecheck) {
    query.ruleCheck = { $exists: false };
  }
  
  const trades = await Trade.find(query).sort({ tradeDate: 1 });
  
  if (trades.length === 0) {
    return {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0
    };
  }
  
  // Get user's enabled rules
  const rules = await TradingRule.find({ user: userId, enabled: true });
  
  if (rules.length === 0) {
    return {
      processed: trades.length,
      created: 0,
      updated: 0,
      errors: 0,
      message: 'No enabled rules to evaluate'
    };
  }
  
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const trade of trades) {
    try {
      // Build trade data for validation
      const tradeData = {
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
        direction: trade.direction,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        reason: trade.reason,
        tradeDate: trade.tradeDate,
        entryTime: trade.entryTime || trade.tradeDate
      };
      
      // Run validation
      const validation = await validateTrade(userId, tradeData, {
        checklistResponses: [],
        preTradeEmotion: trade.preTradeEmotion || null
      });
      
      // Check if trade already has a rule check
      let ruleCheck;
      if (trade.ruleCheck && forceRecheck) {
        // Update existing rule check
        ruleCheck = await TradeRuleCheck.findById(trade.ruleCheck);
        if (ruleCheck) {
          ruleCheck.ruleResults = validation.results;
          ruleCheck.passedRules = validation.passedRules;
          ruleCheck.totalRules = validation.totalRules;
          ruleCheck.warnings = validation.warnings?.length || 0;
          ruleCheck.blocks = validation.blockReasons?.length || 0;
          ruleCheck.tradeAllowed = validation.allowed;
          ruleCheck.disciplineScore = validation.score;
          ruleCheck.checkedAt = new Date();
          await ruleCheck.save();
          updated++;
        }
      }
      
      if (!ruleCheck) {
        // Create new rule check
        ruleCheck = await saveValidationResult(
          userId,
          validation,
          tradeData,
          trade._id
        );
        
        // Link rule check to trade
        trade.ruleCheck = ruleCheck._id;
        await trade.save();
        created++;
      }
    } catch (error) {
      console.error(`Error evaluating rules for trade ${trade._id}:`, error.message);
      errors++;
    }
  }
  
  return {
    processed: trades.length,
    created,
    updated,
    errors,
    rulesEvaluated: rules.length
  };
}

module.exports = {
  validateTrade,
  saveValidationResult,
  evaluateRulesRetroactively,
  getTodayContext,
  getRecentContext,
  checkSingleRule,
  // Export individual checkers for testing
  checkTimeWindow,
  checkMaxDailyTrades,
  checkMaxPositionSize,
  checkMaxDailyLoss,
  checkMinRiskReward,
  checkRequiredStopLoss,
  checkRequiredTakeProfit,
  checkAllowedSymbols,
  checkBlockedSymbols,
  checkMaxConsecutiveLosses,
  checkCoolingOff,
  checkMaxOpenPositions,
  checkRequiredReason
};
