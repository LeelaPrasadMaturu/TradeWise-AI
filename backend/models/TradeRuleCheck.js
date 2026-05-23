const mongoose = require('mongoose');

/**
 * TradeRuleCheck Model
 * Tracks rule validations for each trade attempt (including blocked trades)
 */

const ruleResultSchema = new mongoose.Schema({
  rule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradingRule'
  },
  ruleName: {
    type: String,
    required: true
  },
  ruleType: {
    type: String,
    required: true
  },
  passed: {
    type: Boolean,
    required: true
  },
  action: {
    type: String,
    enum: ['warn', 'block'],
    required: true
  },
  message: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

const checklistResponseSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId
  },
  question: {
    type: String,
    required: true
  },
  response: {
    type: Boolean // true = yes, false = no
  },
  passed: {
    type: Boolean
  },
  action: {
    type: String,
    enum: ['warn', 'block']
  }
}, { _id: false });

const intendedTradeSchema = new mongoose.Schema({
  symbol: String,
  entryPrice: Number,
  quantity: Number,
  direction: {
    type: String,
    enum: ['long', 'short']
  },
  stopLoss: Number,
  takeProfit: Number,
  reason: String,
  positionValue: Number
}, { _id: false });

const tradeRuleCheckSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  trade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trade'
    // Can be null if trade was blocked
  },
  
  checkedAt: {
    type: Date,
    default: Date.now
  },
  
  tradeAllowed: {
    type: Boolean,
    required: true
  },
  
  // Results of each rule check
  ruleResults: [ruleResultSchema],
  
  // Custom checklist responses
  checklistResponses: [checklistResponseSchema],
  
  // Emotional state at entry
  emotionalState: {
    type: String
  },
  emotionPassed: {
    type: Boolean
  },
  emotionMessage: {
    type: String
  },
  
  // Summary statistics
  totalRules: {
    type: Number,
    default: 0
  },
  passedRules: {
    type: Number,
    default: 0
  },
  warnings: {
    type: Number,
    default: 0
  },
  blocks: {
    type: Number,
    default: 0
  },
  
  // Discipline score for this trade (0-100)
  disciplineScore: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // For blocked trades - store intended trade data
  intendedTrade: intendedTradeSchema,
  
  // Context at time of check
  context: {
    todayTradeCount: Number,
    todayPnL: Number,
    consecutiveLosses: Number,
    lastTradeTime: Date,
    openPositions: Number
  }
}, {
  timestamps: true
});

// Indexes
tradeRuleCheckSchema.index({ user: 1, checkedAt: -1 });
tradeRuleCheckSchema.index({ user: 1, trade: 1 });
tradeRuleCheckSchema.index({ user: 1, tradeAllowed: 1 });
tradeRuleCheckSchema.index({ user: 1, disciplineScore: 1 });

// Calculate discipline score based on rule results
tradeRuleCheckSchema.methods.calculateScore = function() {
  if (this.totalRules === 0) {
    this.disciplineScore = 100;
    return 100;
  }
  
  // Weight: blocks are heavier than warnings
  let deductions = 0;
  
  this.ruleResults.forEach(result => {
    if (!result.passed) {
      if (result.action === 'block') {
        deductions += 20; // 20 points per block violation
      } else {
        deductions += 10; // 10 points per warning violation
      }
    }
  });
  
  // Check checklist responses
  this.checklistResponses.forEach(response => {
    if (!response.passed) {
      if (response.action === 'block') {
        deductions += 15;
      } else {
        deductions += 5;
      }
    }
  });
  
  // Check emotion
  if (this.emotionalState && !this.emotionPassed) {
    deductions += 15;
  }
  
  this.disciplineScore = Math.max(0, 100 - deductions);
  return this.disciplineScore;
};

// Pre-save to auto-calculate score
tradeRuleCheckSchema.pre('save', function(next) {
  // Calculate totals
  this.totalRules = this.ruleResults.length;
  this.passedRules = this.ruleResults.filter(r => r.passed).length;
  this.warnings = this.ruleResults.filter(r => !r.passed && r.action === 'warn').length;
  this.blocks = this.ruleResults.filter(r => !r.passed && r.action === 'block').length;
  
  // Calculate score
  this.calculateScore();
  
  next();
});

// Static method to get checks for a period
tradeRuleCheckSchema.statics.getForPeriod = async function(userId, startDate, endDate) {
  return this.find({
    user: userId,
    checkedAt: { $gte: startDate, $lte: endDate }
  }).sort({ checkedAt: -1 });
};

// Static method to get violation summary
tradeRuleCheckSchema.statics.getViolationSummary = async function(userId, periodDays = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const checks = await this.find({
    user: userId,
    checkedAt: { $gte: startDate }
  });
  
  const summary = {
    totalChecks: checks.length,
    allowedTrades: checks.filter(c => c.tradeAllowed).length,
    blockedTrades: checks.filter(c => !c.tradeAllowed).length,
    avgDisciplineScore: 0,
    byRuleType: {},
    byDay: {}
  };
  
  if (checks.length > 0) {
    // Average discipline score
    const scores = checks.filter(c => c.disciplineScore !== undefined);
    if (scores.length > 0) {
      summary.avgDisciplineScore = Math.round(
        scores.reduce((sum, c) => sum + c.disciplineScore, 0) / scores.length
      );
    }
    
    // By rule type
    checks.forEach(check => {
      check.ruleResults.forEach(result => {
        if (!summary.byRuleType[result.ruleType]) {
          summary.byRuleType[result.ruleType] = { checks: 0, violations: 0 };
        }
        summary.byRuleType[result.ruleType].checks++;
        if (!result.passed) {
          summary.byRuleType[result.ruleType].violations++;
        }
      });
      
      // By day
      const day = check.checkedAt.toISOString().split('T')[0];
      if (!summary.byDay[day]) {
        summary.byDay[day] = { checks: 0, violations: 0, blocked: 0 };
      }
      summary.byDay[day].checks++;
      if (check.warnings > 0 || check.blocks > 0) {
        summary.byDay[day].violations++;
      }
      if (!check.tradeAllowed) {
        summary.byDay[day].blocked++;
      }
    });
  }
  
  return summary;
};

// Static method to calculate compliance rate
tradeRuleCheckSchema.statics.getComplianceRate = async function(userId, periodDays = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const result = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        checkedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalChecks: { $sum: 1 },
        compliantTrades: {
          $sum: {
            $cond: [{ $eq: ['$warnings', 0] }, 1, 0]
          }
        },
        avgScore: { $avg: '$disciplineScore' }
      }
    }
  ]);
  
  if (result.length === 0) {
    return { complianceRate: 100, avgScore: 100, totalChecks: 0 };
  }
  
  return {
    complianceRate: Math.round((result[0].compliantTrades / result[0].totalChecks) * 100),
    avgScore: Math.round(result[0].avgScore || 100),
    totalChecks: result[0].totalChecks
  };
};

const TradeRuleCheck = mongoose.model('TradeRuleCheck', tradeRuleCheckSchema);

module.exports = TradeRuleCheck;
