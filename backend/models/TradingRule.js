const mongoose = require('mongoose');

/**
 * TradingRule Model
 * Stores user-defined trading rules for discipline tracking
 */

const RULE_TYPES = [
  'TIME_WINDOW',           // Only trade during specific hours
  'MAX_DAILY_TRADES',      // Limit trades per day
  'MAX_POSITION_SIZE',     // Cap position size
  'MAX_DAILY_LOSS',        // Stop after daily loss limit
  'MIN_RISK_REWARD',       // Minimum R:R ratio
  'REQUIRED_STOP_LOSS',    // Must have stop loss
  'REQUIRED_TAKE_PROFIT',  // Must have take profit
  'ALLOWED_SYMBOLS',       // Whitelist symbols
  'BLOCKED_SYMBOLS',       // Blacklist symbols
  'MAX_CONSECUTIVE_LOSSES', // Stop after loss streak
  'COOLING_OFF_AFTER_LOSS', // Wait after loss
  'MAX_OPEN_POSITIONS',    // Limit concurrent positions
  'MIN_POSITION_SIZE',     // Minimum position size
  'REQUIRED_REASON'        // Must provide trade reason
];

const tradingRuleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  ruleType: {
    type: String,
    enum: RULE_TYPES,
    required: true
  },
  
  enabled: {
    type: Boolean,
    default: true
  },
  
  action: {
    type: String,
    enum: ['warn', 'block'],
    default: 'warn'
  },
  
  // Rule-specific parameters
  params: {
    // TIME_WINDOW
    startHour: { type: Number, min: 0, max: 23 },
    startMinute: { type: Number, min: 0, max: 59 },
    endHour: { type: Number, min: 0, max: 23 },
    endMinute: { type: Number, min: 0, max: 59 },
    
    // MAX_DAILY_TRADES
    maxTrades: { type: Number, min: 1 },
    
    // MAX_POSITION_SIZE / MIN_POSITION_SIZE
    maxSizeType: { type: String, enum: ['percentage', 'absolute'] },
    maxSizeValue: { type: Number, min: 0 },
    minSizeType: { type: String, enum: ['percentage', 'absolute'] },
    minSizeValue: { type: Number, min: 0 },
    
    // MAX_DAILY_LOSS
    maxLossType: { type: String, enum: ['percentage', 'absolute'] },
    maxLossValue: { type: Number, min: 0 },
    
    // MIN_RISK_REWARD
    minRiskReward: { type: Number, min: 0 },
    
    // ALLOWED_SYMBOLS / BLOCKED_SYMBOLS
    symbols: [{ type: String, trim: true, uppercase: true }],
    
    // MAX_CONSECUTIVE_LOSSES
    maxConsecutiveLosses: { type: Number, min: 1 },
    
    // COOLING_OFF_AFTER_LOSS
    coolingMinutes: { type: Number, min: 1 },
    
    // MAX_OPEN_POSITIONS
    maxOpenPositions: { type: Number, min: 1 }
  },
  
  // Statistics
  stats: {
    totalChecks: { type: Number, default: 0 },
    violations: { type: Number, default: 0 },
    lastViolation: { type: Date },
    lastCheck: { type: Date }
  },
  
  // For ordering rules in UI
  priority: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
tradingRuleSchema.index({ user: 1, enabled: 1 });
tradingRuleSchema.index({ user: 1, ruleType: 1 });

// Static method to get enabled rules for user
tradingRuleSchema.statics.getEnabledRules = async function(userId) {
  return this.find({ user: userId, enabled: true }).sort({ priority: 1 });
};

// Static method to increment check count
tradingRuleSchema.statics.recordCheck = async function(ruleId, passed) {
  const update = {
    $inc: { 'stats.totalChecks': 1 },
    $set: { 'stats.lastCheck': new Date() }
  };
  
  if (!passed) {
    update.$inc['stats.violations'] = 1;
    update.$set['stats.lastViolation'] = new Date();
  }
  
  return this.findByIdAndUpdate(ruleId, update, { new: true });
};

// Validate rule params based on rule type
tradingRuleSchema.methods.validateParams = function() {
  const errors = [];
  const { ruleType, params } = this;
  
  switch (ruleType) {
    case 'TIME_WINDOW':
      if (params.startHour === undefined || params.endHour === undefined) {
        errors.push('TIME_WINDOW requires startHour and endHour');
      }
      break;
    case 'MAX_DAILY_TRADES':
      if (!params.maxTrades) {
        errors.push('MAX_DAILY_TRADES requires maxTrades');
      }
      break;
    case 'MAX_POSITION_SIZE':
      if (!params.maxSizeType || !params.maxSizeValue) {
        errors.push('MAX_POSITION_SIZE requires maxSizeType and maxSizeValue');
      }
      break;
    case 'MAX_DAILY_LOSS':
      if (!params.maxLossType || !params.maxLossValue) {
        errors.push('MAX_DAILY_LOSS requires maxLossType and maxLossValue');
      }
      break;
    case 'MIN_RISK_REWARD':
      if (!params.minRiskReward) {
        errors.push('MIN_RISK_REWARD requires minRiskReward');
      }
      break;
    case 'ALLOWED_SYMBOLS':
    case 'BLOCKED_SYMBOLS':
      if (!params.symbols || params.symbols.length === 0) {
        errors.push(`${ruleType} requires at least one symbol`);
      }
      break;
    case 'MAX_CONSECUTIVE_LOSSES':
      if (!params.maxConsecutiveLosses) {
        errors.push('MAX_CONSECUTIVE_LOSSES requires maxConsecutiveLosses');
      }
      break;
    case 'COOLING_OFF_AFTER_LOSS':
      if (!params.coolingMinutes) {
        errors.push('COOLING_OFF_AFTER_LOSS requires coolingMinutes');
      }
      break;
    case 'MAX_OPEN_POSITIONS':
      if (!params.maxOpenPositions) {
        errors.push('MAX_OPEN_POSITIONS requires maxOpenPositions');
      }
      break;
  }
  
  return errors;
};

// Pre-save validation
tradingRuleSchema.pre('save', function(next) {
  const errors = this.validateParams();
  if (errors.length > 0) {
    return next(new Error(errors.join(', ')));
  }
  next();
});

// Rule templates for quick setup
tradingRuleSchema.statics.RULE_TEMPLATES = {
  CONSERVATIVE_INTRADAY: [
    { 
      name: 'Morning Session Only', 
      ruleType: 'TIME_WINDOW', 
      action: 'warn',
      params: { startHour: 9, startMinute: 30, endHour: 11, endMinute: 30 }
    },
    { 
      name: 'Max 3 Trades Per Day', 
      ruleType: 'MAX_DAILY_TRADES', 
      action: 'warn',
      params: { maxTrades: 3 }
    },
    { 
      name: '2% Position Size Limit', 
      ruleType: 'MAX_POSITION_SIZE', 
      action: 'block',
      params: { maxSizeType: 'percentage', maxSizeValue: 2 }
    },
    { 
      name: 'Stop Loss Required', 
      ruleType: 'REQUIRED_STOP_LOSS', 
      action: 'block',
      params: {}
    },
    { 
      name: '5% Daily Loss Limit', 
      ruleType: 'MAX_DAILY_LOSS', 
      action: 'block',
      params: { maxLossType: 'percentage', maxLossValue: 5 }
    }
  ],
  AGGRESSIVE_SCALPER: [
    { 
      name: 'First Hour Trading', 
      ruleType: 'TIME_WINDOW', 
      action: 'warn',
      params: { startHour: 9, startMinute: 15, endHour: 10, endMinute: 15 }
    },
    { 
      name: 'Max 10 Trades Per Day', 
      ruleType: 'MAX_DAILY_TRADES', 
      action: 'warn',
      params: { maxTrades: 10 }
    },
    { 
      name: '5% Daily Loss Limit', 
      ruleType: 'MAX_DAILY_LOSS', 
      action: 'block',
      params: { maxLossType: 'percentage', maxLossValue: 5 }
    },
    { 
      name: 'Cooling Off After Loss', 
      ruleType: 'COOLING_OFF_AFTER_LOSS', 
      action: 'warn',
      params: { coolingMinutes: 10 }
    }
  ],
  SWING_TRADER: [
    { 
      name: 'Max 2 Trades Per Day', 
      ruleType: 'MAX_DAILY_TRADES', 
      action: 'warn',
      params: { maxTrades: 2 }
    },
    { 
      name: 'Min 1:2 Risk Reward', 
      ruleType: 'MIN_RISK_REWARD', 
      action: 'warn',
      params: { minRiskReward: 2 }
    },
    { 
      name: 'Stop Loss Required', 
      ruleType: 'REQUIRED_STOP_LOSS', 
      action: 'block',
      params: {}
    },
    { 
      name: 'Take Profit Required', 
      ruleType: 'REQUIRED_TAKE_PROFIT', 
      action: 'warn',
      params: {}
    },
    { 
      name: 'Max 3 Open Positions', 
      ruleType: 'MAX_OPEN_POSITIONS', 
      action: 'block',
      params: { maxOpenPositions: 3 }
    }
  ]
};

const TradingRule = mongoose.model('TradingRule', tradingRuleSchema);

module.exports = TradingRule;
module.exports.RULE_TYPES = RULE_TYPES;
