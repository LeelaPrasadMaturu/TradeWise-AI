const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const auth = require('../middlewares/authMiddleware');
const { analyzeEmotion, extractTagsFromReason } = require('../services/emotionDetectService');

// Create new trade
router.post('/', auth, async (req, res) => {
  try {
    const trade = new Trade({
      ...req.body,
      user: req.user._id
    });

    // Analyze emotion and extract tags from trade reason if provided
    if (trade.reason) {
      const emotionAnalysis = await analyzeEmotion(trade.reason);
      trade.emotionAnalysis = emotionAnalysis;
      
      // Extract tags from reason and combine with user-provided tags
      const extractedTags = extractTagsFromReason(trade.reason);
      trade.tags = [...new Set([...(trade.tags || []), ...extractedTags])];
    }

    await trade.save();
    res.status(201).json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Error creating trade', error: error.message });
  }
});

// Get all trades for user
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-tradeDate' } = req.query;
    const trades = await Trade.find({ user: req.user._id })
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Trade.countDocuments({ user: req.user._id });

    res.json({
      trades,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trades', error: error.message });
  }
});

// Get trade statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Trade.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          winningTrades: {
            $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] }
          },
          losingTrades: {
            $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] }
          },
          totalProfitLoss: { $sum: '$profitLoss' },
          avgProfitLoss: { $avg: '$profitLoss' }
        }
      }
    ]);

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
          }
        }
      },
      {
        $project: {
          tag: '$_id',
          total: 1,
          wins: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$total'] }, 100] }
        }
      }
    ]);

    res.json({
      overall: stats[0] || {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalProfitLoss: 0,
        avgProfitLoss: 0
      },
      byTag: tagStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trade statistics', error: error.message });
  }
});

// Get single trade
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

// Update trade
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    'symbol', 'entryPrice', 'exitPrice', 'quantity',
    'direction', 'stopLoss', 'takeProfit', 'reason',
    'tags', 'result', 'profitLoss', 'notes', 'chartScreenshot'
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

    updates.forEach(update => {
      if (update !== 'reason' && update !== 'tags') {
        trade[update] = req.body[update];
      }
    });
    
    await trade.save();
    res.json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Error updating trade', error: error.message });
  }
});

// Update specific trade details
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