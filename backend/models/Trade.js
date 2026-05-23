const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: true,
    trim: true
  },
  assetType: {
    type: String,
    enum: ['stock', 'crypto', 'forex', 'commodity'],
    default: 'stock'
  },
  entryPrice: {
    type: Number,
    required: true
  },
  exitPrice: {
    type: Number
  },
  quantity: {
    type: Number,
    required: true
  },
  direction: {
    type: String,
    enum: ['long', 'short'],
    required: true
  },
  stopLoss: {
    type: Number
  },
  takeProfit: {
    type: Number
  },
  reason: {
    type: String,
    trim: true
  },
  exitReason: {
    type: String,
    trim: true
  },
  emotionAnalysis: {
    detected: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    source: {
      type: String,
      enum: ['finbert', 'keyword']
    },
    rawSentiment: String,
    emotionType: String
  },
  exitEmotionAnalysis: {
    detected: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    source: {
      type: String,
      enum: ['finbert', 'keyword']
    },
    rawSentiment: String,
    emotionType: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  result: {
    type: String,
    enum: ['win', 'loss', 'breakeven', 'open']
  },
  profitLoss: {
    type: Number
  },
  notes: {
    type: String,
    trim: true
  },
  postTradeReview: {
    mistakes: { type: String, trim: true },
    planFollowed: { type: String, trim: true },
    stopLossMovement: { type: String, trim: true },
    lessons: { type: String, trim: true }
  },
  postTradeAnalysis: {
    generatedAt: { type: Date },
    model: { type: String, trim: true },
    summary: { type: String },
    recommendations: [{ type: String }],
    risksObserved: [{ type: String }],
    structured: {
      type: Object
    }
  },
  chartScreenshot: {
    type: String
  },
  tradeDate: {
    type: Date,
    default: Date.now
  },
  // Behavioral analysis fields
  entryTime: {
    type: Date,
    default: function() { return this.tradeDate || Date.now(); }
  },
  exitTime: {
    type: Date
  },
  positionValue: {
    type: Number
  },
  // Import metadata
  source: {
    type: String,
    enum: ['manual', 'csv_import', 'api'],
    default: 'manual'
  },
  brokerData: {
    entryOrderId: String,
    exitOrderId: String,
    entryTradeId: String,
    exitTradeId: String,
    exchange: String
  },
  // Discipline tracking
  ruleCheck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradeRuleCheck'
  },
  disciplineScore: {
    type: Number,
    min: 0,
    max: 100
  },
  rulesViolated: [{
    type: String,
    trim: true
  }],
  // Pre-trade emotional state (user-selected)
  preTradeEmotion: {
    type: String,
    enum: [
      'calm', 'neutral', 'confident', 'focused',
      'anxious', 'excited', 'fearful', 'revenge',
      'fomo', 'frustrated', 'uncertain', 'tired', 'impatient'
    ]
  },
  // Checklist responses at entry
  checklistResponses: [{
    question: String,
    response: Boolean
  }]
}, {
  timestamps: true
});

// Index for faster queries
tradeSchema.index({ user: 1, tradeDate: -1 });
tradeSchema.index({ user: 1, symbol: 1 });
tradeSchema.index({ user: 1, tags: 1 });
// Behavioral analysis indexes
tradeSchema.index({ user: 1, entryTime: -1 });
tradeSchema.index({ user: 1, result: 1, entryTime: -1 });
// Discipline tracking indexes
tradeSchema.index({ user: 1, disciplineScore: 1 });
tradeSchema.index({ user: 1, ruleCheck: 1 });

// Virtual for R:R ratio
tradeSchema.virtual('riskRewardRatio').get(function() {
  if (!this.stopLoss || !this.takeProfit) return null;
  const risk = Math.abs(this.entryPrice - this.stopLoss);
  const reward = Math.abs(this.takeProfit - this.entryPrice);
  return reward / risk;
});

// Virtual for position value (if not stored)
tradeSchema.virtual('calculatedPositionValue').get(function() {
  if (this.positionValue) return this.positionValue;
  return this.entryPrice * this.quantity;
});

// Virtual for hold duration in minutes
tradeSchema.virtual('holdDurationMinutes').get(function() {
  if (!this.exitTime || !this.entryTime) return null;
  return (this.exitTime - this.entryTime) / (1000 * 60);
});

// Pre-save hook to auto-calculate positionValue
tradeSchema.pre('save', function(next) {
  if (!this.positionValue && this.entryPrice && this.quantity) {
    this.positionValue = this.entryPrice * this.quantity;
  }
  if (!this.entryTime && this.tradeDate) {
    this.entryTime = this.tradeDate;
  }
  next();
});

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade; 