/**
 * Coach Routes
 * API endpoints for trading coach features
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const User = require('../models/User');
const {
  generateRealTimeAlerts,
  generatePreMarketBriefing,
  getYesterdaySummary,
  getDayOfWeekWarning,
  ALERT_TYPES,
  SEVERITY
} = require('../services/tradingCoachService');
const { triggerBriefingManually, getSchedulerStatus } = require('../services/schedulerService');
const { getFlashbackWarnings, getFlashbackSummary } = require('../services/mistakeFlashbackService');

/**
 * GET /api/coach/briefing
 * Get today's pre-market briefing on-demand
 */
router.get('/briefing', auth, async (req, res) => {
  try {
    const briefing = await generatePreMarketBriefing(req.user._id);
    
    res.json({
      success: true,
      briefing
    });
  } catch (error) {
    console.error('Error generating briefing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate briefing'
    });
  }
});

/**
 * POST /api/coach/briefing/send
 * Manually trigger briefing email (for testing)
 */
router.post('/briefing/send', auth, async (req, res) => {
  try {
    const result = await triggerBriefingManually(req.user._id);
    
    res.json({
      success: true,
      message: 'Briefing sent',
      ...result
    });
  } catch (error) {
    console.error('Error sending briefing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send briefing'
    });
  }
});

/**
 * GET /api/coach/alerts
 * Get current active alerts for the user
 */
router.get('/alerts', auth, async (req, res) => {
  try {
    const alerts = await generateRealTimeAlerts(req.user._id);
    
    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error generating alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate alerts'
    });
  }
});

/**
 * GET /api/coach/summary/yesterday
 * Get yesterday's trading summary
 */
router.get('/summary/yesterday', auth, async (req, res) => {
  try {
    const summary = await getYesterdaySummary(req.user._id);
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error getting yesterday summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get summary'
    });
  }
});

/**
 * GET /api/coach/day-warning
 * Get day-of-week performance warning
 */
router.get('/day-warning', auth, async (req, res) => {
  try {
    const warning = await getDayOfWeekWarning(req.user._id);
    
    res.json({
      success: true,
      hasWarning: !!warning,
      warning
    });
  } catch (error) {
    console.error('Error getting day warning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get day warning'
    });
  }
});

/**
 * GET /api/coach/preferences
 * Get user's coaching preferences
 */
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      preferences: user.coachingPreferences || {
        enableRealTimeAlerts: true,
        enablePreMarketBriefing: true,
        briefingTime: '08:30',
        timezone: 'Asia/Kolkata'
      }
    });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get preferences'
    });
  }
});

/**
 * PATCH /api/coach/preferences
 * Update user's coaching preferences
 */
router.patch('/preferences', auth, async (req, res) => {
  try {
    const allowedFields = [
      'enableRealTimeAlerts',
      'enablePreMarketBriefing',
      'briefingTime',
      'timezone'
    ];
    
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[`coachingPreferences.${field}`] = req.body[field];
      }
    });
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Preferences updated',
      preferences: user.coachingPreferences
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

/**
 * GET /api/coach/status
 * Get scheduler status (admin/debug)
 */
router.get('/status', auth, async (req, res) => {
  try {
    const status = getSchedulerStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

/**
 * GET /api/coach/alert-types
 * Get list of all alert types
 */
router.get('/alert-types', auth, async (req, res) => {
  res.json({
    success: true,
    alertTypes: Object.keys(ALERT_TYPES).map(key => ({
      type: ALERT_TYPES[key],
      key
    })),
    severityLevels: Object.keys(SEVERITY).map(key => ({
      level: SEVERITY[key],
      key
    }))
  });
});

/**
 * GET /api/coach/flashback
 * Get mistake flashback warnings based on context
 * Query params: symbol, hour, emotion
 */
router.get('/flashback', auth, async (req, res) => {
  try {
    const { symbol, hour, emotion } = req.query;
    
    const context = {
      symbol: symbol || undefined,
      currentHour: hour !== undefined ? parseInt(hour) : undefined,
      emotion: emotion || undefined
    };
    
    const result = await getFlashbackSummary(req.user._id, context);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting flashback warnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get flashback warnings'
    });
  }
});

/**
 * GET /api/coach/game-plan
 * Get enhanced pre-market game plan with behavioral recommendations
 */
router.get('/game-plan', auth, async (req, res) => {
  try {
    const briefing = await generatePreMarketBriefing(req.user._id);
    const flashback = await getFlashbackSummary(req.user._id, {});
    
    // Build game plan matching frontend expected structure
    const symbolsToAvoid = [];
    const focusAreas = [];
    const rulesReminder = [];
    const bestTradingHours = [];
    let emotionalCheck = null;
    
    // Extract symbols to avoid from flashback warnings
    const symbolWarnings = flashback.warnings.filter(w => w.type === 'SYMBOL_LOSS');
    symbolWarnings.forEach(sw => {
      if (sw.data?.symbol) {
        symbolsToAvoid.push(sw.data.symbol);
      }
    });
    
    // Add worst performing symbols from briefing
    if (briefing.worstSymbols && briefing.worstSymbols.length > 0) {
      briefing.worstSymbols.forEach(s => {
        if (!symbolsToAvoid.includes(s.symbol)) {
          symbolsToAvoid.push(s.symbol);
        }
      });
    }
    
    // Add focus areas from AI-generated briefing
    if (briefing.focusAreas && briefing.focusAreas.length > 0) {
      focusAreas.push(...briefing.focusAreas);
    }
    
    // Add day-specific warnings as focus areas
    const badDayWarning = flashback.warnings.find(w => w.type === 'BAD_DAY');
    if (badDayWarning) {
      focusAreas.push(badDayWarning.message);
    }
    
    // Add loss streak warning
    const lossStreakWarning = flashback.warnings.find(w => w.type === 'LOSS_STREAK');
    if (lossStreakWarning) {
      emotionalCheck = lossStreakWarning.message + ' - consider taking a break or trading smaller size.';
    }
    
    // Extract best trading hours
    if (briefing.bestHours && briefing.bestHours.length > 0) {
      briefing.bestHours.forEach(h => {
        bestTradingHours.push(h.hour);
      });
    }
    
    // Add rules reminders from yesterday's violations
    if (briefing.rulesViolated && briefing.rulesViolated.rules) {
      briefing.rulesViolated.rules.forEach(rule => {
        rulesReminder.push(`Remember: ${rule}`);
      });
    }
    
    // Add warning about worst hours
    if (briefing.worstHours && briefing.worstHours.length > 0) {
      const worstHoursStr = briefing.worstHours.map(h => `${h.hour}:00`).join(', ');
      rulesReminder.push(`Avoid trading at ${worstHoursStr} (historically low win rate)`);
    }
    
    // Default focus areas if none generated
    if (focusAreas.length === 0) {
      focusAreas.push('Focus on high-quality setups only');
      focusAreas.push('Follow your trading rules strictly');
      focusAreas.push('Wait for clear market direction');
    }
    
    const gamePlan = {
      symbolsToAvoid,
      focusAreas,
      rulesReminder,
      bestTradingHours,
      emotionalCheck
    };
    
    res.json({
      success: true,
      briefing,
      gamePlan,
      flashbackSummary: {
        hasWarnings: flashback.hasWarnings,
        highSeverityCount: flashback.highSeverityCount
      }
    });
  } catch (error) {
    console.error('Error generating game plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate game plan'
    });
  }
});

module.exports = router;
