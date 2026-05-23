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
  // Tax-related fields
  segment: {
    type: String,
    enum: ['equity', 'fno', 'currency', 'commodity'],
    default: 'equity'
  },
  instrumentType: {
    type: String,
    enum: ['stock', 'futures', 'options', 'index'],
    default: 'stock'
  },
  contractExpiry: {
    type: Date
  },
  optionType: {
    type: String,
    enum: ['CE', 'PE']
  },
  strikePrice: {
    type: Number
  },
  exchange: {
    type: String,
    trim: true
  },
  exitDate: {
    type: Date
  },
  charges: {
    brokerage: { type: Number, default: 0 },
    stt: { type: Number, default: 0 },
    stampDuty: { type: Number, default: 0 },
    exchangeCharges: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    sebiCharges: { type: Number, default: 0 },
    totalCharges: { type: Number, default: 0 }
  },
  netProfitLoss: {
    type: Number
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
// Tax and reporting indexes
tradeSchema.index({ user: 1, segment: 1, tradeDate: -1 });
tradeSchema.index({ user: 1, exitDate: -1 });

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

// Virtual for hold duration in days (for STCG/LTCG classification)
tradeSchema.virtual('holdDurationDays').get(function() {
  const exitDt = this.exitDate || this.exitTime;
  const entryDt = this.tradeDate || this.entryTime;
  if (!exitDt || !entryDt) return null;
  return Math.floor((new Date(exitDt) - new Date(entryDt)) / (1000 * 60 * 60 * 24));
});

// Virtual to check if trade qualifies for LTCG (held > 365 days)
tradeSchema.virtual('isLongTerm').get(function() {
  const holdDays = this.holdDurationDays;
  if (holdDays === null) return false;
  return holdDays > 365;
});

// Pre-save hook to auto-calculate positionValue, netProfitLoss, and exitDate
tradeSchema.pre('save', function(next) {
  if (!this.positionValue && this.entryPrice && this.quantity) {
    this.positionValue = this.entryPrice * this.quantity;
  }
  if (!this.entryTime && this.tradeDate) {
    this.entryTime = this.tradeDate;
  }
  // Auto-calculate exitDate from exitTime if not set
  if (this.exitTime && !this.exitDate) {
    this.exitDate = new Date(this.exitTime);
  }
  // Auto-calculate netProfitLoss (profitLoss - totalCharges)
  if (this.profitLoss !== undefined && this.charges && this.charges.totalCharges !== undefined) {
    this.netProfitLoss = this.profitLoss - this.charges.totalCharges;
  } else if (this.profitLoss !== undefined && !this.netProfitLoss) {
    this.netProfitLoss = this.profitLoss;
  }
  next();
});

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade; 