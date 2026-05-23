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

module.exports = router;
