/**
 * Playbook Service
 * Manages trading setups, auto-tags trades, and tracks setup performance
 */

const Playbook = require('../models/Playbook');
const Trade = require('../models/Trade');

/**
 * Get or create playbook for user
 */
async function getPlaybook(userId) {
  return Playbook.getOrCreate(userId);
}

/**
 * Add a new setup to playbook
 */
async function addSetup(userId, setupData) {
  const playbook = await Playbook.getOrCreate(userId);
  
  // Get max order
  const maxOrder = playbook.setups.reduce((max, s) => Math.max(max, s.order || 0), 0);
  
  playbook.setups.push({
    ...setupData,
    order: setupData.order || maxOrder + 1,
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      totalPnL: 0,
      avgPnL: 0,
      winRate: 0,
      profitFactor: 0,
      lastUpdated: new Date()
    }
  });
  
  await playbook.save();
  return playbook;
}

/**
 * Update an existing setup
 */
async function updateSetup(userId, setupId, updates) {
  const playbook = await Playbook.getOrCreate(userId);
  const setup = playbook.setups.id(setupId);
  
  if (!setup) {
    throw new Error('Setup not found');
  }
  
  // Update allowed fields
  const allowedFields = [
    'name', 'description', 'matchCriteria', 'rules', 
    'checklist', 'enabled', 'color', 'icon', 'order'
  ];
  
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      setup[field] = updates[field];
    }
  });
  
  await playbook.save();
  return playbook;
}

/**
 * Delete a setup
 */
async function deleteSetup(userId, setupId) {
  const playbook = await Playbook.getOrCreate(userId);
  
  playbook.setups = playbook.setups.filter(s => s._id.toString() !== setupId);
  await playbook.save();
  
  return playbook;
}

/**
 * Auto-tag a trade with matching setup
 */
async function autoTagTrade(userId, trade) {
  const playbook = await Playbook.getOrCreate(userId);
  
  if (!playbook.settings.autoTagEnabled) {
    return { matched: false, setup: null };
  }
  
  const matchedSetup = playbook.findMatchingSetup(trade);
  
  if (matchedSetup) {
    // Add setup name as tag if not already present
    const setupTag = matchedSetup.name.toLowerCase();
    if (!trade.tags) trade.tags = [];
    if (!trade.tags.includes(setupTag)) {
      trade.tags.push(setupTag);
    }
    
    return {
      matched: true,
      setup: {
        id: matchedSetup._id,
        name: matchedSetup.name,
        color: matchedSetup.color,
        rules: matchedSetup.rules,
        checklist: matchedSetup.checklist
      }
    };
  }
  
  return { matched: false, setup: null };
}

/**
 * Validate trade against setup rules
 */
async function validateAgainstSetup(userId, trade, setupId) {
  const playbook = await Playbook.getOrCreate(userId);
  const setup = playbook.setups.id(setupId);
  
  if (!setup) {
    return { valid: true, violations: [] };
  }
  
  const violations = [];
  const rules = setup.rules;
  
  // Check stop loss requirement
  if (rules.requireStopLoss && !trade.stopLoss) {
    violations.push({
      rule: 'requireStopLoss',
      message: `${setup.name} setup requires a stop loss`
    });
  }
  
  // Check take profit requirement
  if (rules.requireTakeProfit && !trade.takeProfit) {
    violations.push({
      rule: 'requireTakeProfit',
      message: `${setup.name} setup requires a take profit target`
    });
  }
  
  // Check minimum R:R
  if (rules.minRiskReward && trade.stopLoss && trade.takeProfit) {
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - trade.entryPrice);
    const rr = reward / risk;
    
    if (rr < rules.minRiskReward) {
      violations.push({
        rule: 'minRiskReward',
        message: `${setup.name} requires min ${rules.minRiskReward}:1 R:R, got ${rr.toFixed(2)}:1`
      });
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
    setup: setup.name
  };
}

/**
 * Get setup statistics
 */
async function getSetupStats(userId, setupId = null) {
  const playbook = await Playbook.getOrCreate(userId);
  
  if (setupId) {
    const setup = playbook.setups.id(setupId);
    if (!setup) throw new Error('Setup not found');
    
    // Refresh stats
    await playbook.updateSetupStats(setupId);
    return setup.stats;
  }
  
  // Return all setup stats
  await playbook.updateAllStats();
  
  return playbook.setups.map(s => ({
    id: s._id,
    name: s.name,
    color: s.color,
    enabled: s.enabled,
    ...s.stats
  }));
}

/**
 * Get setup performance comparison
 */
async function compareSetups(userId, days = 90) {
  const playbook = await Playbook.getOrCreate(userId);
  await playbook.updateAllStats();
  
  const setups = playbook.setups
    .filter(s => s.enabled && s.stats.totalTrades >= 3)
    .map(s => ({
      id: s._id,
      name: s.name,
      color: s.color,
      ...s.stats
    }));
  
  // Sort by win rate
  setups.sort((a, b) => b.winRate - a.winRate);
  
  // Find best and worst
  const best = setups.filter(s => s.totalPnL > 0);
  const worst = setups.filter(s => s.totalPnL < 0);
  
  // Calculate overall stats
  const totalTrades = setups.reduce((sum, s) => sum + s.totalTrades, 0);
  const totalPnL = setups.reduce((sum, s) => sum + s.totalPnL, 0);
  
  return {
    setups,
    summary: {
      totalSetups: setups.length,
      profitableSetups: best.length,
      unprofitableSetups: worst.length,
      totalTrades,
      totalPnL,
      bestSetup: best[0] || null,
      worstSetup: worst[worst.length - 1] || null
    },
    recommendation: best.length > 0
      ? `Focus on ${best.slice(0, 2).map(s => s.name).join(' and ')} - your most profitable setups`
      : 'Keep tracking your setups to discover your edge'
  };
}

/**
 * Get trades for a specific setup
 */
async function getSetupTrades(userId, setupId, limit = 50) {
  const playbook = await Playbook.getOrCreate(userId);
  const setup = playbook.setups.id(setupId);
  
  if (!setup) throw new Error('Setup not found');
  
  const trades = await Trade.find({
    user: userId,
    tags: setup.name.toLowerCase()
  })
  .sort({ tradeDate: -1 })
  .limit(limit)
  .lean();
  
  return {
    setup: {
      id: setup._id,
      name: setup.name,
      color: setup.color,
      stats: setup.stats
    },
    trades,
    totalFound: trades.length
  };
}

/**
 * Suggest setups based on trade history
 */
async function suggestSetups(userId) {
  const trades = await Trade.find({
    user: userId,
    result: { $in: ['win', 'loss', 'breakeven'] }
  }).lean();
  
  if (trades.length < 20) {
    return { message: 'Need at least 20 trades to suggest setups' };
  }
  
  // Analyze common patterns in winning trades
  const wins = trades.filter(t => t.result === 'win');
  const keywords = {};
  
  wins.forEach(trade => {
    const text = `${trade.reason || ''} ${trade.notes || ''}`.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 3);
    
    words.forEach(word => {
      if (!keywords[word]) keywords[word] = { count: 0, wins: 0, pnl: 0 };
      keywords[word].count++;
      keywords[word].wins++;
      keywords[word].pnl += trade.profitLoss || 0;
    });
  });
  
  // Also count in losing trades to get win rate
  const losses = trades.filter(t => t.result === 'loss');
  losses.forEach(trade => {
    const text = `${trade.reason || ''} ${trade.notes || ''}`.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 3);
    
    words.forEach(word => {
      if (!keywords[word]) keywords[word] = { count: 0, wins: 0, pnl: 0 };
      keywords[word].count++;
      keywords[word].pnl += trade.profitLoss || 0;
    });
  });
  
  // Find high win rate keywords
  const suggestions = Object.entries(keywords)
    .filter(([_, stats]) => stats.count >= 5)
    .map(([keyword, stats]) => ({
      keyword,
      count: stats.count,
      winRate: Math.round((stats.wins / stats.count) * 100),
      totalPnL: stats.pnl
    }))
    .filter(s => s.winRate >= 50)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);
  
  return {
    suggestions,
    message: suggestions.length > 0 
      ? 'Consider creating setups based on these winning patterns'
      : 'No clear patterns found yet - keep trading and journaling'
  };
}

module.exports = {
  getPlaybook,
  addSetup,
  updateSetup,
  deleteSetup,
  autoTagTrade,
  validateAgainstSetup,
  getSetupStats,
  compareSetups,
  getSetupTrades,
  suggestSetups
};
