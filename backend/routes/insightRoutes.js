const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { generateWeeklyInsights } = require('../services/insightsService');

// Get weekly insights
router.get('/weekly', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const insights = await generateWeeklyInsights(req.user._id, startDate, endDate);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ message: 'Error generating insights', error: error.message });
  }
});

// Get performance metrics
router.get('/metrics', auth, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    // TODO: Implement detailed performance metrics
    res.json({
      message: 'Performance metrics coming soon',
      period
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching metrics', error: error.message });
  }
});

// Get strategy analysis
router.get('/strategy', auth, async (req, res) => {
  try {
    const { strategy } = req.query;
    
    // TODO: Implement strategy analysis
    res.json({
      message: 'Strategy analysis coming soon',
      strategy
    });
  } catch (error) {
    res.status(500).json({ message: 'Error analyzing strategy', error: error.message });
  }
});

module.exports = router; 