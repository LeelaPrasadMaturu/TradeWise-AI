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
  }
}, {
  timestamps: true
});

// Index for faster queries
tradeSchema.index({ user: 1, tradeDate: -1 });
tradeSchema.index({ user: 1, symbol: 1 });
tradeSchema.index({ user: 1, tags: 1 });

// Virtual for R:R ratio
tradeSchema.virtual('riskRewardRatio').get(function() {
  if (!this.stopLoss || !this.takeProfit) return null;
  const risk = Math.abs(this.entryPrice - this.stopLoss);
  const reward = Math.abs(this.takeProfit - this.entryPrice);
  return reward / risk;
});

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade; 