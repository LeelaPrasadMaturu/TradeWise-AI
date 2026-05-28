const mongoose = require('mongoose');

const tradeAlertSchema = new mongoose.Schema({
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
    required: true,
    enum: ['crypto', 'stock', 'forex', 'commodity']
  },
  triggerType: {
    type: String,
    required: true,
    enum: ['price_above', 'price_below', 'percentage_change', 'volume_spike']
  },
  triggerValue: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'triggered', 'cancelled'],
    default: 'active'
  },
  notificationChannels: {
    email: { type: Boolean, default: true },
    telegram: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  triggeredAt: {
    type: Date
  },
  description: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for faster queries
tradeAlertSchema.index({ user: 1, status: 1 });
tradeAlertSchema.index({ symbol: 1, assetType: 1 });

const TradeAlert = mongoose.model('TradeAlert', tradeAlertSchema);

module.exports = TradeAlert; 