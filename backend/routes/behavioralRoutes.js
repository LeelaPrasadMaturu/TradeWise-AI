const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const UserBaseline = require('../models/UserBaseline');
const {
  analyzeAllPatterns,
  calculateUserBaseline,
  detectTradingStyle,
  STYLE_CONFIG
} = require('../services/behavioralPatternService');
const Trade = require('../models/Trade');
const redisService = require('../services/redisService');
const { recordPatternDetected } = require('../utils/metrics');

// Cache TTLs
const CACHE_TTL = {
  PATTERNS: 300,    // 5 min (frequently updated)
  SUMMARY: 180,     // 3 min
  BASELINE: 600,    // 10 min (computed from history)
};

/**
 * @swagger
 * components:
 *   schemas:
 *     BehavioralPattern:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           description: Pattern type identifier
 *         severity:
 *           type: string
 *           enum: [high, medium, low]
 *         insight:
 *           type: string
 *         recommendation:
 *           type: string
 *         costEstimate:
 *           type: object
 *           properties:
 *             directCost:
 *               type: number
 *             opportunityCost:
 *               type: number
 *             totalEstimatedCost:
 *               type: number
 *     BehavioralSummary:
 *       type: object
 *       properties:
 *         behavioralScore:
 *           type: number
 *           description: Overall behavioral health score (0-100)
 *         tradingStyle:
 *           type: string
 *           enum: [SCALPER, INTRADAY, SWING, POSITIONAL, UNKNOWN]
 *         patternsDetected:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BehavioralPattern'
 *         positivePatterns:
 *           type: array
 *         recommendations:
 *           type: array
 */

/**
 * @swagger
 * /behavioral/patterns:
 *   get:
 *     summary: Get all detected behavioral patterns
 *     tags: [Behavioral Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 14d, 30d, 60d, 90d]
 *           default: 30d
 *         description: Analysis period
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by pattern type
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: Filter by severity
 *     responses:
 *       200:
 *         description: Behavioral analysis results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BehavioralSummary'
 *       401:
 *         description: Authentication required
 */
router.get('/patterns', auth, async (req, res) => {
  try {
    const { period = '30d', type, severity } = req.query;
    const periodDays = parseInt(period.replace('d', '')) || 30;
    
    // Cache key for pattern analysis
    const cacheKey = redisService.generateKey(
      'behavioral:patterns',
      req.user._id.toString(),
      period
    );
    
    // Use cache-aside with SWR
    const { data: analysis, fromCache } = await redisService.getOrSetSWR(
      cacheKey,
      async () => {
        const result = await analyzeAllPatterns(req.user._id, periodDays);
        
        // Record detected patterns for metrics
        (result?.patternsDetected || []).forEach(p => {
          recordPatternDetected(p.type, p.severity);
        });
        
        return {
          ...result,
          computedAt: new Date().toISOString()
        };
      },
      CACHE_TTL.PATTERNS,
      60 // 1 min stale tolerance
    );
    
    // Apply filters if provided (done on cached data)
    let filteredPatterns = analysis?.patternsDetected || [];
    
    if (type) {
      filteredPatterns = filteredPatterns.filter(p => 
        p.type.toLowerCase().includes(type.toLowerCase())
      );
    }
    
    if (severity) {
      filteredPatterns = filteredPatterns.filter(p => p.severity === severity);
    }
    
    res.json({
      ...analysis,
      patternsDetected: filteredPatterns,
      positivePatterns: analysis?.positivePatterns || [],
      filters: { period, type, severity },
      _cache: { hit: fromCache }
    });
  } catch (error) {
    console.error('Behavioral patterns error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing behavioral patterns',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /behavioral/summary:
 *   get:
 *     summary: Get behavioral health summary
 *     tags: [Behavioral Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Behavioral summary with score and top issues
 */
router.get('/summary', auth, async (req, res) => {
  try {
    const analysis = await analyzeAllPatterns(req.user._id, 30);
    
    // Ensure patternsDetected is an array
    const patternsDetected = analysis?.patternsDetected || [];
    
    // Get top 3 most impactful patterns
    const topPatterns = patternsDetected
      .filter(p => p.severity === 'high' || p.severity === 'medium')
      .slice(0, 3)
      .map(p => ({
        type: p.type,
        severity: p.severity,
        insight: p.insight,
        costEstimate: p.costEstimate?.directCost || 0
      }));
    
    // Calculate total cost of bad patterns
    const totalPatternCost = patternsDetected.reduce((sum, p) => 
      sum + (p.costEstimate?.directCost || 0), 0
    );
    
    const positivePatterns = analysis?.positivePatterns || [];
    const recommendations = analysis?.recommendations || [];
    const baseline = analysis?.baseline || {};
    
    res.json({
      success: true,
      behavioralScore: analysis?.behavioralScore || 0,
      tradingStyle: analysis?.tradingStyle || 'unknown',
      styleConfidence: analysis?.styleConfidence || 0,
      period: analysis?.period || '30 days',
      tradeCount: analysis?.tradeCount || 0,
      summary: {
        totalPatternsDetected: patternsDetected.length,
        highSeverity: patternsDetected.filter(p => p.severity === 'high').length,
        mediumSeverity: patternsDetected.filter(p => p.severity === 'medium').length,
        positivePatterns: positivePatterns.length,
        estimatedCostFromPatterns: totalPatternCost
      },
      topIssues: topPatterns,
      positivePatterns: positivePatterns,
      recommendations: recommendations.slice(0, 3),
      baseline: {
        winRate: baseline.baselineWinRate || 0,
        avgDailyTrades: baseline.avgDailyTradeCount || 0,
        bestHours: baseline.bestPerformingHours || [],
        worstHours: baseline.worstPerformingHours || []
      }
    });
  } catch (error) {
    console.error('Behavioral summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating behavioral summary',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /behavioral/pattern/{type}:
 *   get:
 *     summary: Get detailed analysis of a specific pattern type
 *     tags: [Behavioral Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Pattern type (e.g., REVENGE_TRADING, TILT_STREAK)
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: 30d
 *     responses:
 *       200:
 *         description: Detailed pattern analysis
 *       404:
 *         description: Pattern type not found
 */
router.get('/pattern/:type', auth, async (req, res) => {
  try {
    const { type } = req.params;
    const { period = '30d' } = req.query;
    const periodDays = parseInt(period.replace('d', '')) || 30;
    
    const analysis = await analyzeAllPatterns(req.user._id, periodDays);
    const patternsDetected = analysis?.patternsDetected || [];
    
    const patternInstances = patternsDetected.filter(p => 
      p.type.toLowerCase() === type.toLowerCase() ||
      p.type.toLowerCase().includes(type.toLowerCase())
    );
    
    if (patternInstances.length === 0) {
      return res.json({
        success: true,
        type,
        message: `No ${type} patterns detected in the last ${periodDays} days`,
        occurrences: 0,
        instances: []
      });
    }
    
    // Calculate aggregate stats for this pattern
    const totalCost = patternInstances.reduce((sum, p) => 
      sum + (p.costEstimate?.directCost || 0), 0
    );
    
    const affectedTradeIds = patternInstances.flatMap(p => p.affectedTrades || []);
    
    res.json({
      success: true,
      type,
      period: `${periodDays}d`,
      occurrences: patternInstances.length,
      severityBreakdown: {
        high: patternInstances.filter(p => p.severity === 'high').length,
        medium: patternInstances.filter(p => p.severity === 'medium').length,
        low: patternInstances.filter(p => p.severity === 'low').length
      },
      totalCost,
      affectedTradeCount: [...new Set(affectedTradeIds)].length,
      instances: patternInstances,
      recommendation: analysis.recommendations.find(r => r.basedOn === type) || null
    });
  } catch (error) {
    console.error('Pattern detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pattern details',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /behavioral/baseline:
 *   get:
 *     summary: Get user's trading baseline metrics
 *     tags: [Behavioral Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User baseline metrics
 */
router.get('/baseline', auth, async (req, res) => {
  try {
    let baseline = await UserBaseline.findOne({ user: req.user._id });
    
    if (!baseline) {
      baseline = await calculateUserBaseline(req.user._id, 90);
    }
    
    res.json({
      success: true,
      baseline: {
        tradingStyle: baseline.tradingStyle,
        styleConfidence: baseline.styleConfidence,
        metrics: {
          avgPositionSize: baseline.avgPositionSize,
          avgDailyTradeCount: baseline.avgDailyTradeCount,
          avgHoldDurationMinutes: baseline.avgHoldDurationMinutes,
          baselineWinRate: baseline.baselineWinRate,
          avgWinAmount: baseline.avgWinAmount,
          avgLossAmount: baseline.avgLossAmount,
          profitFactor: baseline.profitFactor,
          maxDrawdown: baseline.maxDrawdown
        },
        variance: {
          positionSizeStdDev: baseline.positionSizeStdDev,
          positionSizeMedian: baseline.positionSizeMedian,
          tradeCountStdDev: baseline.tradeCountStdDev
        },
        timeAnalysis: {
          bestPerformingHours: baseline.bestPerformingHours,
          worstPerformingHours: baseline.worstPerformingHours,
          bestPerformingDays: baseline.bestPerformingDays,
          worstPerformingDays: baseline.worstPerformingDays,
          hourlyPerformance: baseline.hourlyPerformance,
          dailyPerformance: baseline.dailyPerformance
        },
        symbolAnalysis: baseline.symbolPerformance,
        streaks: {
          longestWinStreak: baseline.longestWinStreak,
          longestLossStreak: baseline.longestLossStreak,
          avgWinStreak: baseline.avgWinStreak,
          avgLossStreak: baseline.avgLossStreak
        },
        riskMetrics: {
          avgRiskRewardRatio: baseline.avgRiskRewardRatio,
          tradesWithStopLoss: baseline.tradesWithStopLoss,
          tradesWithTakeProfit: baseline.tradesWithTakeProfit
        },
        meta: {
          basedOnTradeCount: baseline.basedOnTradeCount,
          periodDays: baseline.periodDays,
          calculatedAt: baseline.calculatedAt
        }
      },
      styleConfig: STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN
    });
  } catch (error) {
    console.error('Baseline fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching baseline',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /behavioral/baseline/recalculate:
 *   post:
 *     summary: Force recalculate user baseline
 *     tags: [Behavioral Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               periodDays:
 *                 type: number
 *                 default: 90
 *     responses:
 *       200:
 *         description: Baseline recalculated successfully
 */
router.post('/baseline/recalculate', auth, async (req, res) => {
  try {
    const { periodDays = 90 } = req.body;
    
    const baseline = await calculateUserBaseline(req.user._id, periodDays);
    
    res.json({
      success: true,
      message: 'Baseline recalculated successfully',
      baseline: {
        tradingStyle: baseline.tradingStyle,
        styleConfidence: baseline.styleConfidence,
        avgDailyTradeCount: baseline.avgDailyTradeCount,
        baselineWinRate: baseline.baselineWinRate,
        avgPositionSize: baseline.avgPositionSize,
        basedOnTradeCount: baseline.basedOnTradeCount,
        calculatedAt: baseline.calculatedAt
      }
    });
  } catch (error) {
    console.error('Baseline recalculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recalculating baseline',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /behavioral/style:
 *   get:
 *     summary: Get detected trading style and thresholds
 *     tags: [Behavioral Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trading style information
 */
router.get('/style', auth, async (req, res) => {
  try {
    const baseline = await UserBaseline.findOne({ user: req.user._id });
    
    if (!baseline) {
      return res.json({
        success: true,
        tradingStyle: 'UNKNOWN',
        styleConfidence: 0,
        message: 'Not enough trade data to determine trading style',
        allStyles: Object.keys(STYLE_CONFIG)
      });
    }
    
    const styleDescriptions = {
      SCALPER: 'High-frequency trader (10+ trades/day, holds < 15 min)',
      INTRADAY: 'Day trader (3-10 trades/day, closes all by end of day)',
      SWING: 'Swing trader (few trades/week, holds for days)',
      POSITIONAL: 'Position trader (very few trades, holds for weeks)',
      UNKNOWN: 'Trading style not yet determined'
    };
    
    res.json({
      success: true,
      tradingStyle: baseline.tradingStyle,
      styleConfidence: baseline.styleConfidence,
      description: styleDescriptions[baseline.tradingStyle],
      thresholds: STYLE_CONFIG[baseline.tradingStyle] || STYLE_CONFIG.UNKNOWN,
      metrics: {
        avgDailyTradeCount: baseline.avgDailyTradeCount,
        avgHoldDurationMinutes: baseline.avgHoldDurationMinutes
      },
      allStyles: Object.entries(styleDescriptions).map(([style, desc]) => ({
        style,
        description: desc,
        thresholds: STYLE_CONFIG[style]
      }))
    });
  } catch (error) {
    console.error('Style fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trading style',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /behavioral/supported-patterns:
 *   get:
 *     summary: Get list of all supported pattern types
 *     tags: [Behavioral Analysis]
 *     responses:
 *       200:
 *         description: List of supported patterns
 */
router.get('/supported-patterns', (req, res) => {
  const patterns = [
    {
      type: 'REVENGE_TRADING',
      category: 'timing',
      description: 'Quick re-entry after loss with larger position size',
      severity: 'Typically high'
    },
    {
      type: 'TILT_STREAK',
      category: 'timing',
      description: 'Multiple consecutive losses in short time window',
      severity: 'Varies'
    },
    {
      type: 'OVERTRADING',
      category: 'frequency',
      description: 'Trade count significantly higher than baseline',
      severity: 'Medium to high'
    },
    {
      type: 'RAPID_FIRE',
      category: 'frequency',
      description: 'Multiple trades in very short window',
      severity: 'Medium'
    },
    {
      type: 'POSITION_SIZE_DRIFT_UP',
      category: 'sizing',
      description: 'Sizing up after wins (overconfidence)',
      severity: 'Medium'
    },
    {
      type: 'POSITION_SIZE_DRIFT_DOWN',
      category: 'sizing',
      description: 'Sizing down after losses',
      severity: 'Medium'
    },
    {
      type: 'POSITION_SIZE_CHAOS',
      category: 'sizing',
      description: 'High variance in position sizing',
      severity: 'Medium'
    },
    {
      type: 'TIME_OF_DAY_BIAS',
      category: 'performance',
      description: 'Poor performance at certain hours',
      severity: 'Medium'
    },
    {
      type: 'DAY_OF_WEEK_BIAS',
      category: 'performance',
      description: 'Poor performance on certain days',
      severity: 'Medium'
    },
    {
      type: 'SYMBOL_LOSS_CLUSTERING',
      category: 'performance',
      description: 'Repeated losses on same symbol',
      severity: 'Medium to high'
    },
    {
      type: 'FIRST_TRADE_SYNDROME',
      category: 'timing',
      description: 'First trade of day underperforms',
      severity: 'Medium'
    },
    {
      type: 'LOSS_AVERSION',
      category: 'management',
      description: 'Holding losers longer than winners',
      severity: 'High'
    },
    {
      type: 'NEGATIVE_EMOTION_TRADING',
      category: 'psychology',
      description: 'Trading with detected negative sentiment',
      severity: 'High'
    },
    {
      type: 'FOMO_ENTRY',
      category: 'psychology',
      description: 'Fear of missing out detected in trade reason',
      severity: 'Medium'
    },
    {
      type: 'STOP_LOSS_VIOLATION',
      category: 'management',
      description: 'Not respecting stated stop losses',
      severity: 'High'
    }
  ];
  
  const positivePatterns = [
    { type: 'CONSISTENT_SIZING', description: 'Position sizes within normal variance' },
    { type: 'STOP_LOSS_DISCIPLINE', description: 'Consistently using stop losses' },
    { type: 'EMOTIONAL_NEUTRALITY', description: 'Trading with neutral emotions' },
    { type: 'RECOVERY_PATIENCE', description: 'Taking appropriate breaks after losses' }
  ];
  
  res.json({
    success: true,
    destructivePatterns: patterns,
    positivePatterns,
    categories: ['timing', 'frequency', 'sizing', 'performance', 'management', 'psychology']
  });
});

module.exports = router;
