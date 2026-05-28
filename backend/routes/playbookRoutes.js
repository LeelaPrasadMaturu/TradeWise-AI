/**
 * Playbook Routes
 * Manage trading setups and track their performance
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const playbookService = require('../services/playbookService');

/**
 * @route   GET /api/playbook
 * @desc    Get user's playbook
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const playbook = await playbookService.getPlaybook(req.user._id);
    
    res.json({
      success: true,
      playbook
    });
  } catch (error) {
    console.error('Get playbook error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get playbook',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/playbook/setups
 * @desc    Add a new setup to playbook
 * @access  Private
 */
router.post('/setups', auth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      matchCriteria, 
      rules, 
      checklist,
      color,
      icon 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Setup name is required'
      });
    }
    
    const playbook = await playbookService.addSetup(req.user._id, {
      name,
      description,
      matchCriteria: matchCriteria || {},
      rules: rules || {},
      checklist: checklist || [],
      color,
      icon
    });
    
    res.status(201).json({
      success: true,
      message: 'Setup added successfully',
      playbook
    });
  } catch (error) {
    console.error('Add setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add setup',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/playbook/setups/:setupId
 * @desc    Update a setup
 * @access  Private
 */
router.put('/setups/:setupId', auth, async (req, res) => {
  try {
    const playbook = await playbookService.updateSetup(
      req.user._id,
      req.params.setupId,
      req.body
    );
    
    res.json({
      success: true,
      message: 'Setup updated successfully',
      playbook
    });
  } catch (error) {
    console.error('Update setup error:', error);
    if (error.message === 'Setup not found') {
      return res.status(404).json({
        success: false,
        message: 'Setup not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update setup',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/playbook/setups/:setupId
 * @desc    Delete a setup
 * @access  Private
 */
router.delete('/setups/:setupId', auth, async (req, res) => {
  try {
    const playbook = await playbookService.deleteSetup(
      req.user._id,
      req.params.setupId
    );
    
    res.json({
      success: true,
      message: 'Setup deleted successfully',
      playbook
    });
  } catch (error) {
    console.error('Delete setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete setup',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/playbook/auto-tag
 * @desc    Auto-tag a trade with matching setup
 * @access  Private
 */
router.post('/auto-tag', auth, async (req, res) => {
  try {
    const { trade } = req.body;
    
    if (!trade) {
      return res.status(400).json({
        success: false,
        message: 'Trade data is required'
      });
    }
    
    const result = await playbookService.autoTagTrade(req.user._id, trade);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Auto-tag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-tag trade',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/playbook/validate
 * @desc    Validate trade against setup rules
 * @access  Private
 */
router.post('/validate', auth, async (req, res) => {
  try {
    const { trade, setupId } = req.body;
    
    if (!trade || !setupId) {
      return res.status(400).json({
        success: false,
        message: 'Trade data and setupId are required'
      });
    }
    
    const result = await playbookService.validateAgainstSetup(
      req.user._id,
      trade,
      setupId
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Validate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate trade',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/playbook/stats
 * @desc    Get statistics for all setups or a specific setup
 * @access  Private
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const setupId = req.query.setupId;
    const stats = await playbookService.getSetupStats(req.user._id, setupId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get setup stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/playbook/compare
 * @desc    Compare performance across all setups
 * @access  Private
 */
router.get('/compare', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const comparison = await playbookService.compareSetups(req.user._id, days);
    
    res.json({
      success: true,
      ...comparison
    });
  } catch (error) {
    console.error('Compare setups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare setups',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/playbook/setups/:setupId/trades
 * @desc    Get trades for a specific setup
 * @access  Private
 */
router.get('/setups/:setupId/trades', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await playbookService.getSetupTrades(
      req.user._id,
      req.params.setupId,
      limit
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get setup trades error:', error);
    if (error.message === 'Setup not found') {
      return res.status(404).json({
        success: false,
        message: 'Setup not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to get setup trades',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/playbook/suggestions
 * @desc    Get AI-suggested setups based on trade history
 * @access  Private
 */
router.get('/suggestions', auth, async (req, res) => {
  try {
    const suggestions = await playbookService.suggestSetups(req.user._id);
    
    res.json({
      success: true,
      ...suggestions
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate suggestions',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/playbook/settings
 * @desc    Update playbook settings
 * @access  Private
 */
router.put('/settings', auth, async (req, res) => {
  try {
    const playbook = await playbookService.getPlaybook(req.user._id);
    
    const { autoTagEnabled, requireSetupMatch, trackUnmatchedTrades } = req.body;
    
    if (autoTagEnabled !== undefined) {
      playbook.settings.autoTagEnabled = autoTagEnabled;
    }
    if (requireSetupMatch !== undefined) {
      playbook.settings.requireSetupMatch = requireSetupMatch;
    }
    if (trackUnmatchedTrades !== undefined) {
      playbook.settings.trackUnmatchedTrades = trackUnmatchedTrades;
    }
    
    await playbook.save();
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: playbook.settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

module.exports = router;
