/**
 * Discipline Routes
 * Endpoints for discipline score, reports, and analytics
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const TradeRuleCheck = require('../models/TradeRuleCheck');
const {
  calculatePeriodScore,
  calculateWeeklyReport,
  getComplianceByRule,
  getComplianceCorrelation,
  getViolations,
  getRuleSuggestions
} = require('../services/disciplineScoreService');
const {
  analyzeStopLossMovements,
  analyzeEarlyExits,
  getIndisciplineAnalysis
} = require('../services/indisciplineInsightsService');

/**
 * GET /api/discipline/score
 * Get current discipline score (default: last 7 days)
 */
router.get('/score', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const score = await calculatePeriodScore(req.user._id, days);
    
    res.json({
      success: true,
      ...score
    });
  } catch (error) {
    console.error('Error calculating discipline score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate discipline score'
    });
  }
});

/**
 * GET /api/discipline/score/:period
 * Get discipline score for specific period (7d, 30d, 90d)
 */
router.get('/score/:period', auth, async (req, res) => {
  try {
    const periodMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'week': 7,
      'month': 30,
      'quarter': 90
    };
    
    const days = periodMap[req.params.period] || parseInt(req.params.period) || 7;
    const score = await calculatePeriodScore(req.user._id, days);
    
    res.json({
      success: true,
      ...score
    });
  } catch (error) {
    console.error('Error calculating discipline score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate discipline score'
    });
  }
});

/**
 * GET /api/discipline/weekly-report
 * Get comprehensive weekly discipline report
 */
router.get('/weekly-report', auth, async (req, res) => {
  try {
    const report = await calculateWeeklyReport(req.user._id);
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly report'
    });
  }
});

/**
 * GET /api/discipline/compliance
 * Get compliance breakdown by rule type
 */
router.get('/compliance', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const compliance = await getComplianceByRule(req.user._id, days);
    
    res.json({
      success: true,
      period: `${days} days`,
      byRule: compliance
    });
  } catch (error) {
    console.error('Error getting compliance data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get compliance data'
    });
  }
});

/**
 * GET /api/discipline/correlation
 * Get win rate correlation with compliance
 */
router.get('/correlation', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const correlation = await getComplianceCorrelation(req.user._id, days);
    
    res.json({
      success: true,
      period: `${days} days`,
      ...correlation
    });
  } catch (error) {
    console.error('Error getting correlation data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get correlation data'
    });
  }
});

/**
 * GET /api/discipline/violations
 * Get recent violations
 */
router.get('/violations', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 50;
    
    const violations = await getViolations(req.user._id, {
      periodDays: days,
      limit
    });
    
    res.json({
      success: true,
      count: violations.length,
      violations
    });
  } catch (error) {
    console.error('Error getting violations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get violations'
    });
  }
});

/**
 * GET /api/discipline/suggestions
 * Get rule suggestions based on trading patterns
 */
router.get('/suggestions', auth, async (req, res) => {
  try {
    const suggestions = await getRuleSuggestions(req.user._id);
    
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rule suggestions'
    });
  }
});

/**
 * GET /api/discipline/summary
 * Get a quick discipline summary for dashboard
 */
router.get('/summary', auth, async (req, res) => {
  try {
    const [weekScore, monthCorrelation, complianceRate] = await Promise.all([
      calculatePeriodScore(req.user._id, 7),
      getComplianceCorrelation(req.user._id, 30),
      TradeRuleCheck.getComplianceRate(req.user._id, 30)
    ]);
    
    // Get recent checks summary
    const recentChecks = await TradeRuleCheck.find({
      user: req.user._id
    })
    .sort({ checkedAt: -1 })
    .limit(5);
    
    const lastViolation = recentChecks.find(c => c.warnings > 0 || c.blocks > 0);
    
    res.json({
      success: true,
      summary: {
        weeklyScore: weekScore.score,
        weeklyChecks: weekScore.totalChecks,
        monthlyComplianceRate: complianceRate.complianceRate,
        winRateWhenCompliant: monthCorrelation.winRateWhenCompliant,
        winRateWhenViolating: monthCorrelation.winRateWhenViolating,
        lastViolation: lastViolation ? {
          date: lastViolation.checkedAt,
          violations: lastViolation.ruleResults
            .filter(r => !r.passed)
            .map(r => r.ruleName)
        } : null,
        recentActivity: recentChecks.slice(0, 3).map(c => ({
          date: c.checkedAt,
          score: c.disciplineScore,
          allowed: c.tradeAllowed,
          warnings: c.warnings,
          blocks: c.blocks
        }))
      }
    });
  } catch (error) {
    console.error('Error getting discipline summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discipline summary'
    });
  }
});

/**
 * GET /api/discipline/history
 * Get full rule check history
 */
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [checks, total] = await Promise.all([
      TradeRuleCheck.find({ user: req.user._id })
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('trade', 'symbol direction result profitLoss'),
      TradeRuleCheck.countDocuments({ user: req.user._id })
    ]);
    
    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      checks: checks.map(c => ({
        id: c._id,
        checkedAt: c.checkedAt,
        tradeAllowed: c.tradeAllowed,
        disciplineScore: c.disciplineScore,
        totalRules: c.totalRules,
        passedRules: c.passedRules,
        warnings: c.warnings,
        blocks: c.blocks,
        emotionalState: c.emotionalState,
        trade: c.trade,
        intendedTrade: c.intendedTrade,
        violations: c.ruleResults.filter(r => !r.passed)
      }))
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get check history'
    });
  }
});

/**
 * GET /api/discipline/check/:checkId
 * Get details of a specific rule check
 */
router.get('/check/:checkId', auth, async (req, res) => {
  try {
    const check = await TradeRuleCheck.findOne({
      _id: req.params.checkId,
      user: req.user._id
    }).populate('trade');
    
    if (!check) {
      return res.status(404).json({
        success: false,
        error: 'Rule check not found'
      });
    }
    
    res.json({
      success: true,
      check
    });
  } catch (error) {
    console.error('Error getting check details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get check details'
    });
  }
});

/**
 * GET /api/discipline/blocked
 * Get blocked trade attempts
 */
router.get('/blocked', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const blockedChecks = await TradeRuleCheck.find({
      user: req.user._id,
      tradeAllowed: false,
      checkedAt: { $gte: startDate }
    }).sort({ checkedAt: -1 });
    
    res.json({
      success: true,
      period: `${days} days`,
      count: blockedChecks.length,
      blockedTrades: blockedChecks.map(c => ({
        id: c._id,
        checkedAt: c.checkedAt,
        intendedTrade: c.intendedTrade,
        blockReasons: c.ruleResults
          .filter(r => !r.passed && r.action === 'block')
          .map(r => ({
            ruleName: r.ruleName,
            message: r.message
          })),
        emotionalState: c.emotionalState,
        emotionPassed: c.emotionPassed
      }))
    });
  } catch (error) {
    console.error('Error getting blocked trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blocked trades'
    });
  }
});

/**
 * GET /api/discipline/indiscipline
 * Get combined indiscipline analysis (SL movements + early exits)
 */
router.get('/indiscipline', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const analysis = await getIndisciplineAnalysis(req.user._id, days);
    
    res.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error('Error getting indiscipline analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get indiscipline analysis'
    });
  }
});

/**
 * GET /api/discipline/stop-loss-analysis
 * Get detailed stop-loss movement analysis
 */
router.get('/stop-loss-analysis', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const analysis = await analyzeStopLossMovements(req.user._id, days);
    
    res.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error('Error getting stop-loss analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stop-loss analysis'
    });
  }
});

/**
 * GET /api/discipline/early-exit-analysis
 * Get detailed early exit analysis
 */
router.get('/early-exit-analysis', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const analysis = await analyzeEarlyExits(req.user._id, days);
    
    res.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error('Error getting early exit analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get early exit analysis'
    });
  }
});

module.exports = router;
