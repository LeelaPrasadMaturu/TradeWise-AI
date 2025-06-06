const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { generateWeeklyInsights } = require('../services/insightsService');

/**
 * @swagger
 * components:
 *   schemas:
 *     WeeklyInsights:
 *       type: object
 *       properties:
 *         period:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date
 *             endDate:
 *               type: string
 *               format: date
 *         tradingActivity:
 *           type: object
 *           properties:
 *             totalTrades:
 *               type: integer
 *             winningTrades:
 *               type: integer
 *             losingTrades:
 *               type: integer
 *             winRate:
 *               type: number
 *         profitLoss:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             average:
 *               type: number
 *         topPerformingAssets:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               symbol:
 *                 type: string
 *               profitLoss:
 *                 type: number
 *               winRate:
 *                 type: number
 *         emotionalAnalysis:
 *           type: object
 *           properties:
 *             dominantEmotions:
 *               type: array
 *               items:
 *                 type: string
 *             sentimentScore:
 *               type: number
 */

/**
 * @swagger
 * /insights/weekly:
 *   get:
 *     summary: Get weekly trading insights
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for insights (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for insights (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Weekly insights generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WeeklyInsights'
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Error generating insights
 */
router.get('/weekly', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const insights = await generateWeeklyInsights(req.user._id, startDate, endDate);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ message: 'Error generating insights', error: error.message });
  }
});

/**
 * @swagger
 * /insights/metrics:
 *   get:
 *     summary: Get performance metrics
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: week
 *         description: Time period for metrics
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 period:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Error fetching metrics
 */
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

/**
 * @swagger
 * /insights/strategy:
 *   get:
 *     summary: Get strategy analysis
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: strategy
 *         schema:
 *           type: string
 *         description: Strategy name to analyze
 *     responses:
 *       200:
 *         description: Strategy analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 strategy:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Error analyzing strategy
 */
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