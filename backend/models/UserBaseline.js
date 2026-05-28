const mongoose = require('mongoose');

/**
 * UserBaseline Model
 * Stores calculated trading metrics and detected trading style for behavioral analysis
 * This is recalculated periodically based on user's trade history
 */
const userBaselineSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Auto-detected trading style
  tradingStyle: {
    type: String,
    enum: ['SCALPER', 'INTRADAY', 'SWING', 'POSITIONAL', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  styleConfidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },

  // Core metrics (calculated from user's history)
  avgPositionSize: {
    type: Number,
    default: 0
  },
  avgDailyTradeCount: {
    type: Number,
    default: 0
  },
  avgHoldDurationMinutes: {
    type: Number,
    default: 0
  },
  baselineWinRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  avgWinAmount: {
    type: Number,
    default: 0
  },
  avgLossAmount: {
    type: Number,
    default: 0
  },
  totalProfitLoss: {
    type: Number,
    default: 0
  },
  profitFactor: {
    type: Number,
    default: 0
  },

  // Variance metrics (for deviation detection)
  positionSizeStdDev: {
    type: Number,
    default: 0
  },
  positionSizeMedian: {
    type: Number,
    default: 0
  },
  tradeCountStdDev: {
    type: Number,
    default: 0
  },
  holdDurationStdDev: {
    type: Number,
    default: 0
  },

  // Time-based performance analysis
  hourlyPerformance: [{
    hour: { type: Number, min: 0, max: 23 },
    tradeCount: Number,
    winRate: Number,
    totalPnL: Number
  }],
  dailyPerformance: [{
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0=Sunday
    tradeCount: Number,
    winRate: Number,
    totalPnL: Number
  }],
  bestPerformingHours: [{
    type: Number,
    min: 0,
    max: 23
  }],
  worstPerformingHours: [{
    type: Number,
    min: 0,
    max: 23
  }],
  bestPerformingDays: [{
    type: Number,
    min: 0,
    max: 6
  }],
  worstPerformingDays: [{
    type: Number,
    min: 0,
    max: 6
  }],

  // Symbol performance
  symbolPerformance: [{
    symbol: String,
    tradeCount: Number,
    winRate: Number,
    totalPnL: Number,
    avgHoldMinutes: Number
  }],

  // Streak analysis
  longestWinStreak: {
    type: Number,
    default: 0
  },
  longestLossStreak: {
    type: Number,
    default: 0
  },
  avgWinStreak: {
    type: Number,
    default: 0
  },
  avgLossStreak: {
    type: Number,
    default: 0
  },

  // Risk metrics
  maxDrawdown: {
    type: Number,
    default: 0
  },
  avgRiskRewardRatio: {
    type: Number,
    default: 0
  },
  tradesWithStopLoss: {
    type: Number,
    default: 0
  },
  tradesWithTakeProfit: {
    type: Number,
    default: 0
  },

  // Calculation metadata
  basedOnTradeCount: {
    type: Number,
    default: 0
  },
  periodDays: {
    type: Number,
    default: 30
  },
  oldestTradeDate: {
    type: Date
  },
  newestTradeDate: {
    type: Date
  },
  calculatedAt: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Index for quick lookup
userBaselineSchema.index({ calculatedAt: -1 });

// Static method to get or create baseline for user
userBaselineSchema.statics.getOrCreate = async function(userId) {
  let baseline = await this.findOne({ user: userId });
  if (!baseline) {
    baseline = new this({ user: userId });
    await baseline.save();
  }
  return baseline;
};

// Instance method to check if baseline needs recalculation
userBaselineSchema.methods.needsRecalculation = function(hoursThreshold = 24) {
  if (!this.calculatedAt) return true;
  const hoursSinceCalc = (Date.now() - this.calculatedAt) / (1000 * 60 * 60);
  return hoursSinceCalc > hoursThreshold;
};

// Instance method to get style-specific config
userBaselineSchema.methods.getStyleConfig = function() {
  const STYLE_CONFIG = {
    SCALPER: {
      revengeWindowMinutes: 10,
      tiltStreakCount: 6,
      overtradingMultiplier: 2,
      rapidFireMinutes: 2,
      sizeDeviationThreshold: 0.3,
      minTradesForPattern: 20
    },
    INTRADAY: {
      revengeWindowMinutes: 120,
      tiltStreakCount: 4,
      overtradingMultiplier: 3,
      rapidFireMinutes: 30,
      sizeDeviationThreshold: 0.5,
      minTradesForPattern: 10
    },
    SWING: {
      revengeWindowMinutes: 1440, // 1 day
      tiltStreakCount: 3,
      overtradingMultiplier: 5,
      rapidFireMinutes: 240,
      sizeDeviationThreshold: 0.75,
      minTradesForPattern: 5
    },
    POSITIONAL: {
      revengeWindowMinutes: 4320, // 3 days
      tiltStreakCount: 2,
      overtradingMultiplier: 10,
      rapidFireMinutes: 1440,
      sizeDeviationThreshold: 1.0,
      minTradesForPattern: 3
    },
    UNKNOWN: {
      revengeWindowMinutes: 120,
      tiltStreakCount: 4,
      overtradingMultiplier: 3,
      rapidFireMinutes: 30,
      sizeDeviationThreshold: 0.5,
      minTradesForPattern: 10
    }
  };

  return STYLE_CONFIG[this.tradingStyle] || STYLE_CONFIG.UNKNOWN;
};

const UserBaseline = mongoose.model('UserBaseline', userBaselineSchema);

module.exports = UserBaseline;
