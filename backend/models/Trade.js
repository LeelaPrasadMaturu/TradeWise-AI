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
  // Stop-Loss Movement Tracking
  originalStopLoss: {
    type: Number
  },
  movedStopLoss: {
    type: Boolean,
    default: false
  },
  movedStopLossDown: {
    type: Boolean,
    default: false
  },
  stopLossMovementReason: {
    type: String,
    trim: true
  },
  stopLossMovements: [{
    fromPrice: Number,
    toPrice: Number,
    movedAt: Date,
    direction: {
      type: String,
      enum: ['tightened', 'widened', 'breakeven']
    },
    reason: String
  }],
  // Early Exit Tracking
  earlyExit: {
    exitedBeforeTarget: { type: Boolean, default: false },
    exitedInProfit: { type: Boolean, default: false },
    targetWasReachable: { type: Boolean },
    percentToTarget: { type: Number },
    exitReason: {
      type: String,
      enum: ['fear', 'impatience', 'news', 'time_constraint', 'changed_view', 'partial_profit', 'other']
    },
    priceAfterExit: { type: Number },
    maxPriceAfterExit: { type: Number },
    targetHitAfterExit: { type: Boolean },
    missedProfitAmount: { type: Number }
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
// Indiscipline tracking indexes
tradeSchema.index({ user: 1, movedStopLossDown: 1 });
tradeSchema.index({ user: 1, 'earlyExit.exitedBeforeTarget': 1 });

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

// Virtual to calculate extra loss from moving SL down
tradeSchema.virtual('stopLossMovementImpact').get(function() {
  if (!this.movedStopLossDown || !this.originalStopLoss || !this.stopLoss) return null;
  if (!this.exitPrice || this.result !== 'loss') return null;
  
  const originalRisk = Math.abs(this.entryPrice - this.originalStopLoss) * this.quantity;
  const actualLoss = Math.abs(this.profitLoss || 0);
  const extraLoss = actualLoss - originalRisk;
  
  return extraLoss > 0 ? extraLoss : 0;
});

// Virtual to check if trade was an early exit
tradeSchema.virtual('wasEarlyExit').get(function() {
  if (!this.takeProfit || !this.exitPrice || this.result === 'open') return false;
  
  const isLong = this.direction === 'long';
  const targetReached = isLong 
    ? this.exitPrice >= this.takeProfit 
    : this.exitPrice <= this.takeProfit;
  
  return !targetReached && this.result === 'win';
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
  
  // Auto-set originalStopLoss on first save if stopLoss is set
  if (this.isNew && this.stopLoss && !this.originalStopLoss) {
    this.originalStopLoss = this.stopLoss;
  }
  
  // Detect if SL was moved down (widened risk) - for long positions
  if (this.originalStopLoss && this.stopLoss && this.originalStopLoss !== this.stopLoss) {
    this.movedStopLoss = true;
    const isLong = this.direction === 'long';
    // For long: SL moved down = widened risk, SL moved up = tightened
    // For short: SL moved up = widened risk, SL moved down = tightened
    if (isLong) {
      this.movedStopLossDown = this.stopLoss < this.originalStopLoss;
    } else {
      this.movedStopLossDown = this.stopLoss > this.originalStopLoss;
    }
  }
  
  // Auto-detect early exit in profit
  if (this.takeProfit && this.exitPrice && this.profitLoss > 0) {
    const isLong = this.direction === 'long';
    const distanceToTarget = isLong 
      ? this.takeProfit - this.exitPrice 
      : this.exitPrice - this.takeProfit;
    
    if (distanceToTarget > 0) {
      // Exited before target was hit
      if (!this.earlyExit) this.earlyExit = {};
      this.earlyExit.exitedBeforeTarget = true;
      this.earlyExit.exitedInProfit = true;
      
      const totalTargetDistance = Math.abs(this.takeProfit - this.entryPrice);
      const achievedDistance = Math.abs(this.exitPrice - this.entryPrice);
      this.earlyExit.percentToTarget = totalTargetDistance > 0 
        ? Math.round((achievedDistance / totalTargetDistance) * 100) 
        : 0;
    }
  }
  
  next();
});

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade; 