/**
 * Trading Rules Routes
 * CRUD operations for user trading rules and configuration
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TradingRule = require('../models/TradingRule');
const UserTradingConfig = require('../models/UserTradingConfig');
const { validateTrade } = require('../services/ruleValidationService');

// ============================================
// TRADING RULES ENDPOINTS
// ============================================

/**
 * GET /api/rules
 * Get all trading rules for the authenticated user
 */
router.get('/', auth, async (req, res) => {
  try {
    const rules = await TradingRule.find({ user: req.user._id })
      .sort({ priority: 1, createdAt: -1 });
    
    res.json({
      success: true,
      count: rules.length,
      rules
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading rules'
    });
  }
});

/**
 * GET /api/rules/templates
 * Get rule templates for quick setup
 */
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = TradingRule.RULE_TEMPLATES;
    
    res.json({
      success: true,
      templates: Object.entries(templates).map(([name, rules]) => ({
        name,
        displayName: name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        rules: rules.map(r => ({
          name: r.name,
          ruleType: r.ruleType,
          action: r.action,
          params: r.params
        }))
      }))
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rule templates'
    });
  }
});

/**
 * POST /api/rules/templates/:templateName/apply
 * Apply a rule template
 */
router.post('/templates/:templateName/apply', auth, async (req, res) => {
  try {
    const { templateName } = req.params;
    const templates = TradingRule.RULE_TEMPLATES;
    
    if (!templates[templateName]) {
      return res.status(404).json({
        success: false,
        error: `Template "${templateName}" not found`
      });
    }
    
    const templateRules = templates[templateName];
    const createdRules = [];
    
    for (const rule of templateRules) {
      // Check if rule with same type already exists
      const existing = await TradingRule.findOne({
        user: req.user._id,
        ruleType: rule.ruleType
      });
      
      if (!existing) {
        const newRule = new TradingRule({
          user: req.user._id,
          ...rule
        });
        await newRule.save();
        createdRules.push(newRule);
      }
    }
    
    res.status(201).json({
      success: true,
      message: `Applied template "${templateName}"`,
      rulesCreated: createdRules.length,
      rules: createdRules
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply template'
    });
  }
});

/**
 * GET /api/rules/:id
 * Get a specific rule
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const rule = await TradingRule.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    res.json({
      success: true,
      rule
    });
  } catch (error) {
    console.error('Error fetching rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rule'
    });
  }
});

/**
 * POST /api/rules
 * Create a new trading rule
 */
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, ruleType, action, params, priority } = req.body;
    
    // Validate required fields
    if (!name || !ruleType) {
      return res.status(400).json({
        success: false,
        error: 'Name and rule type are required'
      });
    }
    
    // Check for duplicate rule type (optional - allow multiple of same type)
    const existingCount = await TradingRule.countDocuments({
      user: req.user._id,
      ruleType
    });
    
    const rule = new TradingRule({
      user: req.user._id,
      name,
      description,
      ruleType,
      action: action || 'warn',
      params: params || {},
      priority: priority || existingCount
    });
    
    await rule.save();
    
    res.status(201).json({
      success: true,
      message: 'Rule created successfully',
      rule
    });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create rule'
    });
  }
});

/**
 * PATCH /api/rules/:id
 * Update a trading rule
 */
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, description, action, params, priority, enabled } = req.body;
    
    const rule = await TradingRule.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    // Update fields
    if (name !== undefined) rule.name = name;
    if (description !== undefined) rule.description = description;
    if (action !== undefined) rule.action = action;
    if (params !== undefined) rule.params = { ...rule.params, ...params };
    if (priority !== undefined) rule.priority = priority;
    if (enabled !== undefined) rule.enabled = enabled;
    
    await rule.save();
    
    res.json({
      success: true,
      message: 'Rule updated successfully',
      rule
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update rule'
    });
  }
});

/**
 * POST /api/rules/:id/toggle
 * Enable/disable a rule
 */
router.post('/:id/toggle', auth, async (req, res) => {
  try {
    const rule = await TradingRule.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    rule.enabled = !rule.enabled;
    await rule.save();
    
    res.json({
      success: true,
      message: `Rule ${rule.enabled ? 'enabled' : 'disabled'}`,
      rule
    });
  } catch (error) {
    console.error('Error toggling rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle rule'
    });
  }
});

/**
 * DELETE /api/rules/:id
 * Delete a trading rule
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const rule = await TradingRule.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rule'
    });
  }
});

// ============================================
// TRADING CONFIG ENDPOINTS
// ============================================

/**
 * GET /api/rules/config
 * Get user's trading configuration
 */
router.get('/config/settings', auth, async (req, res) => {
  try {
    const config = await UserTradingConfig.getOrCreate(req.user._id);
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading config'
    });
  }
});

/**
 * PATCH /api/rules/config
 * Update user's trading configuration
 */
router.patch('/config/settings', auth, async (req, res) => {
  try {
    const config = await UserTradingConfig.getOrCreate(req.user._id);
    
    const allowedFields = [
      'checklistEnabled',
      'blockOnFailure',
      'requireEmotionalCheck',
      'allowedEmotions',
      'blockedEmotions',
      'requirePreTradeReason',
      'minReasonLength',
      'notifyOnViolation',
      'suggestRulesFromPatterns',
      'weeklyReportEnabled',
      'weeklyReportDay'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    });
    
    await config.save();
    
    res.json({
      success: true,
      message: 'Config updated successfully',
      config
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update config'
    });
  }
});

/**
 * PATCH /api/rules/config/capital
 * Update trading capital
 */
router.patch('/config/capital', auth, async (req, res) => {
  try {
    const { capital, note } = req.body;
    
    if (capital === undefined || capital < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid capital amount is required'
      });
    }
    
    const config = await UserTradingConfig.getOrCreate(req.user._id);
    await config.updateCapital(capital, note || '');
    
    res.json({
      success: true,
      message: 'Capital updated successfully',
      tradingCapital: config.tradingCapital,
      capitalHistory: config.capitalHistory.slice(-5)
    });
  } catch (error) {
    console.error('Error updating capital:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update capital'
    });
  }
});

/**
 * POST /api/rules/config/checklist/items
 * Add a custom checklist item
 */
router.post('/config/checklist/items', auth, async (req, res) => {
  try {
    const { question, description, required, action } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }
    
    const config = await UserTradingConfig.getOrCreate(req.user._id);
    await config.addChecklistItem({
      question,
      description,
      required: required || false,
      action: action || 'warn'
    });
    
    res.status(201).json({
      success: true,
      message: 'Checklist item added',
      checklistItems: config.customChecklistItems
    });
  } catch (error) {
    console.error('Error adding checklist item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add checklist item'
    });
  }
});

/**
 * PATCH /api/rules/config/checklist/items/:itemId
 * Update a custom checklist item
 */
router.patch('/config/checklist/items/:itemId', auth, async (req, res) => {
  try {
    const config = await UserTradingConfig.getOrCreate(req.user._id);
    const item = config.customChecklistItems.id(req.params.itemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Checklist item not found'
      });
    }
    
    const { question, description, required, action, enabled, order } = req.body;
    
    if (question !== undefined) item.question = question;
    if (description !== undefined) item.description = description;
    if (required !== undefined) item.required = required;
    if (action !== undefined) item.action = action;
    if (enabled !== undefined) item.enabled = enabled;
    if (order !== undefined) item.order = order;
    
    await config.save();
    
    res.json({
      success: true,
      message: 'Checklist item updated',
      item
    });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update checklist item'
    });
  }
});

/**
 * DELETE /api/rules/config/checklist/items/:itemId
 * Remove a custom checklist item
 */
router.delete('/config/checklist/items/:itemId', auth, async (req, res) => {
  try {
    const config = await UserTradingConfig.getOrCreate(req.user._id);
    await config.removeChecklistItem(req.params.itemId);
    
    res.json({
      success: true,
      message: 'Checklist item removed',
      checklistItems: config.customChecklistItems
    });
  } catch (error) {
    console.error('Error removing checklist item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove checklist item'
    });
  }
});

// ============================================
// PRE-TRADE VALIDATION ENDPOINT
// ============================================

/**
 * POST /api/rules/validate
 * Validate a trade against all rules (pre-trade check)
 */
router.post('/validate', auth, async (req, res) => {
  try {
    const {
      symbol,
      entryPrice,
      quantity,
      direction,
      stopLoss,
      takeProfit,
      reason,
      entryTime,
      checklistResponses,
      preTradeEmotion
    } = req.body;
    
    // Validate required fields
    if (!symbol || !entryPrice || !quantity || !direction) {
      return res.status(400).json({
        success: false,
        error: 'Symbol, entry price, quantity, and direction are required'
      });
    }
    
    const tradeData = {
      symbol,
      entryPrice,
      quantity,
      direction,
      stopLoss,
      takeProfit,
      reason,
      entryTime: entryTime || new Date(),
      positionValue: entryPrice * quantity
    };
    
    const validation = await validateTrade(req.user._id, tradeData, {
      checklistResponses: checklistResponses || [],
      preTradeEmotion
    });
    
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('Error validating trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate trade'
    });
  }
});

module.exports = router;
