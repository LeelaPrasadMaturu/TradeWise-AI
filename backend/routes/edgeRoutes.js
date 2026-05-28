/**
 * Edge Analysis Routes
 * Provides comprehensive trading statistics by multiple dimensions
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const edgeAnalysisService = require('../services/edgeAnalysisService');
const timeInTradeService = require('../services/timeInTradeService');

/**
 * @route   GET /api/edge/analysis
 * @desc    Get comprehensive edge analysis
 * @access  Private
 */
router.get('/analysis', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const analysis = await edgeAnalysisService.getEdgeAnalysis(req.user._id, days);
    
    res.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error('Edge analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate edge analysis',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/edge/compare
 * @desc    Compare edge between two periods
 * @access  Private
 */
router.get('/compare', auth, async (req, res) => {
  try {
    const currentDays = parseInt(req.query.currentDays) || 30;
    const previousDays = parseInt(req.query.previousDays) || 30;
    
    const comparison = await edgeAnalysisService.compareEdge(
      req.user._id, 
      currentDays, 
      previousDays
    );
    
    res.json({
      success: true,
      ...comparison
    });
  } catch (error) {
    console.error('Edge comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare edge',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/edge/time-alerts
 * @desc    Get alerts for overheld trades
 * @access  Private
 */
router.get('/time-alerts', auth, async (req, res) => {
  try {
    const alerts = await timeInTradeService.getOverheldTrades(req.user._id);
    
    res.json({
      success: true,
      ...alerts
    });
  } catch (error) {
    console.error('Time alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get time alerts',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/edge/hold-time-analysis
 * @desc    Get hold time analysis (winners vs losers)
 * @access  Private
 */
router.get('/hold-time-analysis', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const analysis = await timeInTradeService.getHoldTimeAnalysis(req.user._id, days);
    
    res.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error('Hold time analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze hold times',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/edge/check-trade/:tradeId
 * @desc    Check if a specific trade is being overheld
 * @access  Private
 */
router.get('/check-trade/:tradeId', auth, async (req, res) => {
  try {
    const result = await timeInTradeService.checkTradeHoldTime(
      req.user._id, 
      req.params.tradeId
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Trade check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check trade',
      error: error.message
    });
  }
});

module.exports = router;
