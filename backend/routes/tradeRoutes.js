const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const User = require('../models/User');
const auth = require('../middlewares/authMiddleware');
const { analyzeEmotion, extractTagsFromReason } = require('../services/emotionDetectService');
const { generatePostTradeAnalysis } = require('../services/postTradeAnalysisService');
const { validateTrade, saveValidationResult } = require('../services/ruleValidationService');
const UserTradingConfig = require('../models/UserTradingConfig');
const { generateRealTimeAlerts } = require('../services/tradingCoachService');
const playbookService = require('../services/playbookService');

/**
 * @swagger
 * components:
 *   schemas:
 *     Trade:
 *       type: object
 *       required:
 *         - symbol
 *         - entryPrice
 *         - quantity
 *         - direction
 *       properties:
 *         symbol:
 *           type: string
 *           description: Trading symbol (e.g., BTC/USD)
 *         entryPrice:
 *           type: number
 *           description: Entry price of the trade
 *         exitPrice:
 *           type: number
 *           description: Exit price of the trade
 *         quantity:
 *           type: number
 *           description: Quantity of the trade
 *         direction:
 *           type: string
 *           enum: [long, short]
 *           description: Trade direction
 *         stopLoss:
 *           type: number
 *           description: Stop loss price
 *         takeProfit:
 *           type: number
 *           description: Take profit price
 *         reason:
 *           type: string
 *           description: Reason for taking the trade
 *         exitReason:
 *           type: string
 *           description: Reason for exiting the trade
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags associated with the trade
 *         result:
 *           type: string
 *           enum: [win, loss, breakeven, open]
 *           description: Trade result
 *         profitLoss:
 *           type: number
 *           description: Profit or loss amount
 *         notes:
 *           type: string
 *           description: Additional notes
 *         postTradeReview:
 *           type: object
 *           properties:
 *             mistakes:
 *               type: string
 *             planFollowed:
 *               type: string
 *             stopLossMovement:
 *               type: string
 *             lessons:
 *               type: string
 *         chartScreenshot:
 *           type: string
 *           description: URL to chart screenshot
 *         emotionAnalysis:
 *           type: object
 *           description: Emotion analysis of the trade reason
 */

/**
 * @swagger
 * /trades:
 *   post:
 *     summary: Create a new trade
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Trade'
 *     responses:
 *       201:
 *         description: Trade created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       401:
 *         description: Authentication required
 */
router.post('/', auth, async (req, res) => {
  try {
    const { checklistResponses, preTradeEmotion, skipValidation, ...tradeData } = req.body;
    
    // Run pre-trade validation (always runs for scoring, but only blocks when !skipValidation)
    let validation = null;
    let ruleCheck = null;
    
    const config = await UserTradingConfig.getOrCreate(req.user._id);
    
    if (config.checklistEnabled || await hasEnabledRules(req.user._id)) {
      validation = await validateTrade(req.user._id, tradeData, {
        checklistResponses: checklistResponses || [],
        preTradeEmotion
      });
      
      // Block trade if validation fails and we're not skipping validation
      if (!skipValidation && !validation.allowed) {
        // Save the blocked attempt
        ruleCheck = await saveValidationResult(
          req.user._id, 
          validation, 
          tradeData, 
          null
        );
        
        return res.status(403).json({
          blocked: true,
          message: 'Trade blocked by your trading rules. If you want to proceed anyway, you can bypass this block — your discipline score will be penalized.',
          ruleCheckId: ruleCheck._id,
          violations: validation.blockReasons,
          warnings: validation.warnings,
          score: validation.score,
          summary: validation.summary
        });
      }
    }
    
    // Auto-set entryTime to current time for manual entries
    if (!tradeData.entryTime) {
      tradeData.entryTime = new Date();
    }

    const trade = new Trade({
      ...tradeData,
      user: req.user._id,
      preTradeEmotion,
      checklistResponses: checklistResponses || []
    });

    // Add discipline data if validation was performed
    if (validation) {
      trade.rulesViolated = validation.violations;
      trade.disciplineScore = validation.score;
    }

    // Analyze emotion and extract tags from trade reason if provided
    if (trade.reason) {
      const emotionAnalysis = await analyzeEmotion(trade.reason);
      trade.emotionAnalysis = emotionAnalysis;
      
      // Extract tags from reason and combine with user-provided tags
      const extractedTags = extractTagsFromReason(trade.reason);
      trade.tags = [...new Set([...(trade.tags || []), ...extractedTags])];
    }

    // Auto-tag with playbook setup
    await playbookService.autoTagTrade(req.user._id, trade);

    await trade.save();

    // Save rule check result and link to trade
    if (validation) {
      ruleCheck = await saveValidationResult(
        req.user._id, 
        validation, 
        tradeData, 
        trade._id
      );
      trade.ruleCheck = ruleCheck._id;
      await trade.save();
    }

    // Generate initial post-trade analysis if exit data present
    if (trade.exitPrice || trade.exitReason || trade.postTradeReview) {
      try {
        trade.postTradeAnalysis = await generatePostTradeAnalysis(trade);
        await trade.save();
      } catch (e) {
        console.error('Post-trade analysis error:', e.message);
      }
    }
    
    // Build response
    const response = trade.toObject();
    if (validation) {
      response.ruleValidation = {
        score: validation.score,
        warnings: validation.warnings,
        summary: validation.summary
      };
    }
    
    // Generate real-time coach alerts
    try {
      const user = await User.findById(req.user._id);
      if (user?.coachingPreferences?.enableRealTimeAlerts !== false) {
        response.coachAlerts = await generateRealTimeAlerts(req.user._id, trade);
      }
    } catch (coachError) {
      console.error('Coach alerts error:', coachError.message);
    }
    
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error creating trade', error: error.message });
  }
});

// Helper function to check if user has any enabled rules
async function hasEnabledRules(userId) {
  const TradingRule = require('../models/TradingRule');
  const count = await TradingRule.countDocuments({ user: userId, enabled: true });
  return count > 0;
}

/**
 * @swagger
 * /trades:
 *   get:
 *     summary: Get all trades for the authenticated user
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -tradeDate
 *         description: Sort field and direction
 *     responses:
 *       200:
 *         description: List of trades
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 trades:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Trade'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: Authentication required
 */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-tradeDate', startDate, endDate, symbol, result } = req.query;
    
    // Build query filter
    const filter = { user: req.user._id };
    
    // Date filtering
    if (startDate || endDate) {
      filter.tradeDate = {};
      if (startDate) {
        filter.tradeDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.tradeDate.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }
    
    // Symbol filtering
    if (symbol) {
      filter.symbol = { $regex: symbol, $options: 'i' };
    }
    
    // Result filtering
    if (result) {
      filter.result = result;
    }
    
    const trades = await Trade.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Trade.countDocuments(filter);

    res.json({
      trades,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trades', error: error.message });
  }
});

/**
 * @swagger
 * /trades/stats:
 *   get:
 *     summary: Get trade statistics
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trade statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overall:
 *                   type: object
 *                   properties:
 *                     totalTrades:
 *                       type: integer
 *                     winningTrades:
 *                       type: integer
 *                     losingTrades:
 *                       type: integer
 *                     totalProfitLoss:
 *                       type: number
 *                     avgProfitLoss:
 *                       type: number
 *                 byTag:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tag:
 *                         type: string
 *                       total:
 *                         type: integer
 *                       wins:
 *                         type: integer
 *                       winRate:
 *                         type: number
 *       401:
 *         description: Authentication required
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Trade.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          openTrades: {
            $sum: { $cond: [{ $eq: ['$result', 'open'] }, 1, 0] }
          },
          winningTrades: {
            $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] }
          },
          losingTrades: {
            $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] }
          },
          breakevenTrades: {
            $sum: { $cond: [{ $eq: ['$result', 'breakeven'] }, 1, 0] }
          },
          totalProfitLoss: { $sum: '$profitLoss' },
          avgProfitLoss: { $avg: '$profitLoss' },
          avgWin: {
            $avg: { $cond: [{ $eq: ['$result', 'win'] }, '$profitLoss', null] }
          },
          avgLoss: {
            $avg: { $cond: [{ $eq: ['$result', 'loss'] }, '$profitLoss', null] }
          },
          totalWinAmount: {
            $sum: { $cond: [{ $eq: ['$result', 'win'] }, '$profitLoss', 0] }
          },
          totalLossAmount: {
            $sum: { $cond: [{ $eq: ['$result', 'loss'] }, { $abs: '$profitLoss' }, 0] }
          }
        }
      }
    ]);

    const raw = stats[0] || {
      totalTrades: 0, openTrades: 0, winningTrades: 0, losingTrades: 0,
      breakevenTrades: 0, totalProfitLoss: 0, avgProfitLoss: 0,
      avgWin: 0, avgLoss: 0, totalWinAmount: 0, totalLossAmount: 0
    };

    const closedTrades = raw.winningTrades + raw.losingTrades + raw.breakevenTrades;
    const winRate = closedTrades > 0 ? (raw.winningTrades / closedTrades) * 100 : 0;
    const profitFactor = raw.totalLossAmount > 0 ? raw.totalWinAmount / raw.totalLossAmount : 0;

    // Get win rate by tag
    const tagStats = await Trade.aggregate([
      { $match: { user: req.user._id } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          total: { $sum: 1 },
          wins: {
            $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] }
          },
          totalPnL: { $sum: '$profitLoss' }
        }
      },
      {
        $project: {
          tag: '$_id',
          count: '$total',
          wins: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$total'] }, 100] },
          totalPnL: 1
        }
      }
    ]);

    const byTag = {};
    tagStats.forEach(t => {
      byTag[t.tag] = { count: t.count, wins: t.wins, winRate: t.winRate, totalPnL: t.totalPnL };
    });

    res.json({
      totalTrades: raw.totalTrades,
      openTrades: raw.openTrades,
      closedTrades,
      winningTrades: raw.winningTrades,
      losingTrades: raw.losingTrades,
      winRate,
      totalProfitLoss: raw.totalProfitLoss,
      avgProfitLoss: raw.avgProfitLoss || 0,
      avgWin: raw.avgWin || 0,
      avgLoss: raw.avgLoss || 0,
      profitFactor,
      byTag
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trade statistics', error: error.message });
  }
});

/**
 * @swagger
 * /trades/{id}:
 *   get:
 *     summary: Get a single trade by ID
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trade ID
 *     responses:
 *       200:
 *         description: Trade details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Trade not found
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    res.json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trade', error: error.message });
  }
});

/**
 * @swagger
 * /trades/{id}:
 *   patch:
 *     summary: Update a trade
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trade ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               symbol:
 *                 type: string
 *               entryPrice:
 *                 type: number
 *               exitPrice:
 *                 type: number
 *               quantity:
 *                 type: number
 *               direction:
 *                 type: string
 *                 enum: [long, short]
 *               stopLoss:
 *                 type: number
 *               takeProfit:
 *                 type: number
 *               reason:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               result:
 *                 type: string
 *                 enum: [win, loss, breakeven, open]
 *               profitLoss:
 *                 type: number
 *               notes:
 *                 type: string
 *               chartScreenshot:
 *                 type: string
 *               exitReason:
 *                 type: string
 *               postTradeReview:
 *                 type: object
 *                 properties:
 *                   mistakes:
 *                     type: string
 *                   planFollowed:
 *                     type: string
 *                   stopLossMovement:
 *                     type: string
 *                   lessons:
 *                     type: string
 *     responses:
 *       200:
 *         description: Trade updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       400:
 *         description: Invalid updates
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Trade not found
 */
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    'symbol', 'entryPrice', 'exitPrice', 'quantity',
    'direction', 'stopLoss', 'takeProfit', 'reason', 'exitReason',
    'tags', 'result', 'profitLoss', 'notes', 'chartScreenshot', 'postTradeReview',
    'preTradeEmotion', 'tradeDate', 'entryTime', 'exitTime', 'exitDate',
    'assetType', 'segment', 'instrumentType', 'source'
  ];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).json({ message: 'Invalid updates' });
  }

  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // If reason is updated, re-analyze emotion and extract tags
    if (updates.includes('reason')) {
      const emotionAnalysis = await analyzeEmotion(req.body.reason);
      trade.emotionAnalysis = emotionAnalysis;
      
      // Extract tags from reason and combine with user-provided tags
      const extractedTags = extractTagsFromReason(req.body.reason);
      const userTags = req.body.tags || trade.tags || [];
      trade.tags = [...new Set([...userTags, ...extractedTags])];
    }

  // If exitReason is updated, analyze exit emotion
  if (updates.includes('exitReason')) {
    const exitEmotion = await analyzeEmotion(req.body.exitReason);
    trade.exitEmotionAnalysis = exitEmotion;
  }

  // Auto-set exitTime when closing a trade
  if (updates.includes('result') && ['win', 'loss', 'breakeven'].includes(req.body.result) && !updates.includes('exitTime')) {
    trade.exitTime = new Date();
  }

    updates.forEach(update => {
      if (update !== 'reason' && update !== 'tags') {
        trade[update] = req.body[update];
      }
    });

    // Auto-tag with playbook setup
    await playbookService.autoTagTrade(req.user._id, trade);
    
    await trade.save();

    // If exit-related fields or review changed, regenerate analysis
    if (updates.some(u => ['exitPrice', 'exitReason', 'postTradeReview', 'result', 'profitLoss'].includes(u))) {
      try {
        trade.postTradeAnalysis = await generatePostTradeAnalysis(trade);
        await trade.save();
      } catch (e) {
        console.error('Post-trade analysis error:', e.message);
      }
    }
    res.json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Error updating trade', error: error.message });
  }
});

/**
 * @swagger
 * /trades/{id}/details:
 *   patch:
 *     summary: Update specific trade details
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trade ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entryPrice:
 *                 type: number
 *                 required: true
 *               exitPrice:
 *                 type: number
 *               stopLoss:
 *                 type: number
 *               takeProfit:
 *                 type: number
 *               notes:
 *                 type: string
 *               chartScreenshot:
 *                 type: string
 *     responses:
 *       200:
 *         description: Trade details updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       400:
 *         description: Invalid fields provided
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Trade not found
 */
router.patch('/:id/details', auth, async (req, res) => {
  const allowedDetails = {
    entryPrice: { type: 'number', required: true },
    exitPrice: { type: 'number', required: false },
    stopLoss: { type: 'number', required: false },
    takeProfit: { type: 'number', required: false },
    notes: { type: 'string', required: false },
    chartScreenshot: { type: 'string', required: false }
  };

  try {
    // Validate request body
    const updates = Object.keys(req.body);
    const invalidFields = updates.filter(field => !allowedDetails[field]);
    
    if (invalidFields.length > 0) {
      return res.status(400).json({
        message: 'Invalid fields provided',
        invalidFields
      });
    }

    // Validate field types
    for (const [field, value] of Object.entries(req.body)) {
      const fieldConfig = allowedDetails[field];
      if (fieldConfig.required && !value) {
        return res.status(400).json({
          message: `${field} is required`,
          field
        });
      }
      if (value && typeof value !== fieldConfig.type) {
        return res.status(400).json({
          message: `${field} must be of type ${fieldConfig.type}`,
          field
        });
      }
    }

    const trade = await Trade.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // Update only the provided fields
    updates.forEach(update => {
      trade[update] = req.body[update];
    });

    // If exitPrice is updated, calculate profit/loss
    if (updates.includes('exitPrice')) {
      const multiplier = trade.direction === 'long' ? 1 : -1;
      trade.profitLoss = (trade.exitPrice - trade.entryPrice) * trade.quantity * multiplier;
      
      // Update result based on profit/loss
      if (trade.profitLoss > 0) {
        trade.result = 'win';
      } else if (trade.profitLoss < 0) {
        trade.result = 'loss';
      } else {
        trade.result = 'breakeven';
      }
    }

    await trade.save();
    res.json(trade);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error updating trade details', 
      error: error.message 
    });
  }
});

// Delete trade
router.delete('/:id', auth, async (req, res) => {
  try {
    const trade = await Trade.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    res.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting trade', error: error.message });
  }
});

module.exports = router; 