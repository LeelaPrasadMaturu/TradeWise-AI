const mongoose = require('mongoose');

/**
 * UserTradingConfig Model
 * Stores user's trading capital, checklist preferences, and discipline settings
 */

const EMOTIONAL_STATES = [
  'calm',
  'neutral', 
  'confident',
  'focused',
  'anxious',
  'excited',
  'fearful',
  'revenge',
  'fomo',
  'frustrated',
  'uncertain',
  'tired',
  'impatient'
];

const customChecklistItemSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  required: {
    type: Boolean,
    default: false
  },
  action: {
    type: String,
    enum: ['warn', 'block'],
    default: 'warn'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

const userTradingConfigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Capital tracking (for percentage-based rules)
  tradingCapital: {
    type: Number,
    min: 0,
    default: 0
  },
  capitalLastUpdated: {
    type: Date
  },
  capitalHistory: [{
    amount: Number,
    date: Date,
    note: String
  }],
  
  // Checklist configuration
  checklistEnabled: {
    type: Boolean,
    default: false
  },
  blockOnFailure: {
    type: Boolean,
    default: false
  },
  requireEmotionalCheck: {
    type: Boolean,
    default: false
  },
  
  // Custom checklist items (beyond automated rules)
  customChecklistItems: [customChecklistItemSchema],
  
  // Emotional state configuration
  allowedEmotions: [{
    type: String,
    enum: EMOTIONAL_STATES
  }],
  blockedEmotions: [{
    type: String,
    enum: EMOTIONAL_STATES
  }],
  
  // Pre-trade settings
  requirePreTradeReason: {
    type: Boolean,
    default: false
  },
  minReasonLength: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Notification preferences for rule violations
  notifyOnViolation: {
    type: Boolean,
    default: true
  },
  
  // Auto-suggestions
  suggestRulesFromPatterns: {
    type: Boolean,
    default: true
  },
  
  // Discipline tracking preferences
  weeklyReportEnabled: {
    type: Boolean,
    default: true
  },
  weeklyReportDay: {
    type: Number,
    min: 0,
    max: 6,
    default: 0 // Sunday
  },
  
  // Statistics
  stats: {
    totalTradesChecked: { type: Number, default: 0 },
    totalViolations: { type: Number, default: 0 },
    totalBlocked: { type: Number, default: 0 },
    lastCheckDate: { type: Date }
  }
}, {
  timestamps: true
});

// Index
userTradingConfigSchema.index({ user: 1 });

// Static method to get or create config for user
userTradingConfigSchema.statics.getOrCreate = async function(userId) {
  let config = await this.findOne({ user: userId });
  if (!config) {
    config = new this({ 
      user: userId,
      // Default allowed emotions
      allowedEmotions: ['calm', 'neutral', 'confident', 'focused'],
      // Default blocked emotions
      blockedEmotions: ['revenge', 'fomo', 'frustrated', 'tired'],
      // Default checklist items
      customChecklistItems: [
        {
          question: 'Is this setup in my trading playbook?',
          required: false,
          action: 'warn',
          enabled: true,
          order: 1
        },
        {
          question: 'Have I analyzed the chart on multiple timeframes?',
          required: false,
          action: 'warn',
          enabled: true,
          order: 2
        },
        {
          question: 'Do I have a clear exit plan (stop loss & target)?',
          required: false,
          action: 'warn',
          enabled: true,
          order: 3
        }
      ]
    });
    await config.save();
  }
  return config;
};

// Method to update capital
userTradingConfigSchema.methods.updateCapital = async function(newCapital, note = '') {
  // Store in history
  this.capitalHistory.push({
    amount: this.tradingCapital,
    date: this.capitalLastUpdated || this.createdAt,
    note: 'Previous capital'
  });
  
  // Keep only last 12 entries
  if (this.capitalHistory.length > 12) {
    this.capitalHistory = this.capitalHistory.slice(-12);
  }
  
  this.tradingCapital = newCapital;
  this.capitalLastUpdated = new Date();
  
  if (note) {
    this.capitalHistory.push({
      amount: newCapital,
      date: new Date(),
      note
    });
  }
  
  return this.save();
};

// Method to add checklist item
userTradingConfigSchema.methods.addChecklistItem = function(item) {
  const maxOrder = this.customChecklistItems.reduce((max, i) => Math.max(max, i.order || 0), 0);
  
  this.customChecklistItems.push({
    ...item,
    order: item.order || maxOrder + 1
  });
  
  return this.save();
};

// Method to remove checklist item
userTradingConfigSchema.methods.removeChecklistItem = function(itemId) {
  this.customChecklistItems = this.customChecklistItems.filter(
    item => item._id.toString() !== itemId.toString()
  );
  return this.save();
};

// Method to check if emotion is allowed
userTradingConfigSchema.methods.isEmotionAllowed = function(emotion) {
  if (!this.requireEmotionalCheck) return { allowed: true };
  
  if (this.blockedEmotions.includes(emotion)) {
    return { 
      allowed: false, 
      reason: `Trading while feeling "${emotion}" is blocked by your settings`
    };
  }
  
  if (this.allowedEmotions.length > 0 && !this.allowedEmotions.includes(emotion)) {
    return { 
      allowed: false, 
      reason: `"${emotion}" is not in your list of allowed emotional states`
    };
  }
  
  return { allowed: true };
};

// Method to record a check
userTradingConfigSchema.methods.recordCheck = async function(violated, blocked) {
  this.stats.totalTradesChecked = (this.stats.totalTradesChecked || 0) + 1;
  if (violated) {
    this.stats.totalViolations = (this.stats.totalViolations || 0) + 1;
  }
  if (blocked) {
    this.stats.totalBlocked = (this.stats.totalBlocked || 0) + 1;
  }
  this.stats.lastCheckDate = new Date();
  return this.save();
};

// Virtual for compliance rate
userTradingConfigSchema.virtual('complianceRate').get(function() {
  if (!this.stats.totalTradesChecked) return 100;
  const compliant = this.stats.totalTradesChecked - this.stats.totalViolations;
  return Math.round((compliant / this.stats.totalTradesChecked) * 100);
});

const UserTradingConfig = mongoose.model('UserTradingConfig', userTradingConfigSchema);

module.exports = UserTradingConfig;
module.exports.EMOTIONAL_STATES = EMOTIONAL_STATES;
