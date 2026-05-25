const mongoose = require('mongoose');

/**
 * Playbook Model
 * Defines trading setups that can be auto-matched to trades
 * Tracks win rate per setup to help traders understand what works
 */

const setupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Matching criteria for auto-tagging
  matchCriteria: {
    // Keywords to match in trade reason
    keywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    
    // Symbols this setup applies to (empty = all)
    symbols: [{
      type: String,
      trim: true,
      uppercase: true
    }],
    
    // Direction preference
    direction: {
      type: String,
      enum: ['long', 'short', 'both'],
      default: 'both'
    },
    
    // Time window when this setup is valid
    validHours: {
      start: { type: Number, min: 0, max: 23 },
      end: { type: Number, min: 0, max: 23 }
    },
    
    // Tags that indicate this setup
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  },
  
  // Rules for this setup (what makes it valid)
  rules: {
    requireStopLoss: { type: Boolean, default: true },
    requireTakeProfit: { type: Boolean, default: false },
    minRiskReward: { type: Number, min: 0 },
    maxPositionPercent: { type: Number, min: 0, max: 100 }
  },
  
  // Entry checklist specific to this setup
  checklist: [{
    question: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false }
  }],
  
  // Performance statistics (auto-calculated)
  stats: {
    totalTrades: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    breakeven: { type: Number, default: 0 },
    totalPnL: { type: Number, default: 0 },
    avgPnL: { type: Number, default: 0 },
    avgWin: { type: Number, default: 0 },
    avgLoss: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    profitFactor: { type: Number, default: 0 },
    lastUpdated: { type: Date }
  },
  
  enabled: {
    type: Boolean,
    default: true
  },
  
  // Visual/display settings
  color: {
    type: String,
    default: '#3b82f6' // Blue
  },
  
  icon: {
    type: String,
    default: 'target'
  },
  
  order: {
    type: Number,
    default: 0
  }
}, { _id: true, timestamps: true });

const playbookSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  name: {
    type: String,
    default: 'My Trading Playbook',
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  setups: [setupSchema],
  
  // Global settings
  settings: {
    autoTagEnabled: { type: Boolean, default: true },
    requireSetupMatch: { type: Boolean, default: false }, // Block trades not matching any setup
    trackUnmatchedTrades: { type: Boolean, default: true }
  },
  
  // Unmatched trade stats
  unmatchedStats: {
    totalTrades: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalPnL: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
playbookSchema.index({ user: 1 });

// Static method to get or create playbook
playbookSchema.statics.getOrCreate = async function(userId) {
  let playbook = await this.findOne({ user: userId });
  if (!playbook) {
    playbook = new this({
      user: userId,
      setups: [
        {
          name: 'Breakout',
          description: 'Price breaks above resistance with volume',
          matchCriteria: {
            keywords: ['breakout', 'break out', 'breaking out', 'resistance break'],
            direction: 'long',
            tags: ['breakout']
          },
          rules: { requireStopLoss: true, minRiskReward: 1.5 },
          checklist: [
            { question: 'Is volume above average?', required: false },
            { question: 'Is this a clean breakout (not fakeout)?', required: true }
          ],
          color: '#22c55e',
          icon: 'trending-up',
          order: 1
        },
        {
          name: 'Breakdown',
          description: 'Price breaks below support with volume',
          matchCriteria: {
            keywords: ['breakdown', 'break down', 'support break', 'breaking down'],
            direction: 'short',
            tags: ['breakdown']
          },
          rules: { requireStopLoss: true, minRiskReward: 1.5 },
          checklist: [
            { question: 'Is volume confirming the move?', required: false }
          ],
          color: '#ef4444',
          icon: 'trending-down',
          order: 2
        },
        {
          name: 'Pullback to Support',
          description: 'Long entry on pullback to support in uptrend',
          matchCriteria: {
            keywords: ['pullback', 'retest', 'support', 'buying dip', 'bounce'],
            direction: 'long',
            tags: ['pullback', 'support']
          },
          rules: { requireStopLoss: true },
          color: '#3b82f6',
          icon: 'corner-down-right',
          order: 3
        }
      ]
    });
    await playbook.save();
  }
  return playbook;
};

// Method to find matching setup for a trade
playbookSchema.methods.findMatchingSetup = function(trade) {
  if (!this.settings.autoTagEnabled) return null;
  
  const enabledSetups = this.setups.filter(s => s.enabled);
  
  for (const setup of enabledSetups) {
    if (matchesSetup(trade, setup)) {
      return setup;
    }
  }
  
  return null;
};

// Helper function to check if trade matches setup criteria
function matchesSetup(trade, setup) {
  const criteria = setup.matchCriteria;
  
  // Check direction
  if (criteria.direction !== 'both' && trade.direction !== criteria.direction) {
    return false;
  }
  
  // Check symbols (if specified)
  if (criteria.symbols && criteria.symbols.length > 0) {
    const tradeSymbol = trade.symbol?.toUpperCase();
    if (!criteria.symbols.includes(tradeSymbol)) {
      return false;
    }
  }
  
  // Check time window (if specified)
  if (criteria.validHours?.start !== undefined && criteria.validHours?.end !== undefined) {
    const tradeHour = new Date(trade.entryTime || trade.tradeDate).getHours();
    if (tradeHour < criteria.validHours.start || tradeHour > criteria.validHours.end) {
      return false;
    }
  }
  
  // Check keywords in reason
  const reason = (trade.reason || '').toLowerCase();
  const exitReason = (trade.exitReason || '').toLowerCase();
  const notes = (trade.notes || '').toLowerCase();
  const combinedText = `${reason} ${exitReason} ${notes}`;
  
  if (criteria.keywords && criteria.keywords.length > 0) {
    const hasKeyword = criteria.keywords.some(keyword => 
      combinedText.includes(keyword.toLowerCase())
    );
    if (hasKeyword) return true;
  }
  
  // Check tags
  const tradeTags = (trade.tags || []).map(t => t.toLowerCase());
  if (criteria.tags && criteria.tags.length > 0) {
    const hasTag = criteria.tags.some(tag => 
      tradeTags.includes(tag.toLowerCase())
    );
    if (hasTag) return true;
  }
  
  return false;
}

// Method to update setup stats
playbookSchema.methods.updateSetupStats = async function(setupId) {
  const Trade = require('./Trade');
  
  const setup = this.setups.id(setupId);
  if (!setup) return;
  
  // Find all trades tagged with this setup
  const trades = await Trade.find({
    user: this.user,
    tags: setup.name.toLowerCase(),
    result: { $in: ['win', 'loss', 'breakeven'] }
  }).lean();
  
  if (trades.length === 0) {
    setup.stats = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      totalPnL: 0,
      avgPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      winRate: 0,
      profitFactor: 0,
      lastUpdated: new Date()
    };
  } else {
    const wins = trades.filter(t => t.result === 'win');
    const losses = trades.filter(t => t.result === 'loss');
    const totalPnL = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const winAmount = wins.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const lossAmount = Math.abs(losses.reduce((sum, t) => sum + (t.profitLoss || 0), 0));
    
    setup.stats = {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      breakeven: trades.filter(t => t.result === 'breakeven').length,
      totalPnL: Math.round(totalPnL),
      avgPnL: Math.round(totalPnL / trades.length),
      avgWin: wins.length > 0 ? Math.round(winAmount / wins.length) : 0,
      avgLoss: losses.length > 0 ? Math.round(lossAmount / losses.length) : 0,
      winRate: Math.round((wins.length / trades.length) * 100),
      profitFactor: lossAmount > 0 ? Math.round((winAmount / lossAmount) * 100) / 100 : 0,
      lastUpdated: new Date()
    };
  }
  
  return this.save();
};

// Method to update all setup stats
playbookSchema.methods.updateAllStats = async function() {
  for (const setup of this.setups) {
    await this.updateSetupStats(setup._id);
  }
  return this;
};

const Playbook = mongoose.model('Playbook', playbookSchema);

module.exports = Playbook;
