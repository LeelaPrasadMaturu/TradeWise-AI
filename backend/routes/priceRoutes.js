const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');
const auth = require('../middlewares/authMiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Price:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *           description: Trading symbol (e.g., BTC/USD)
 *         price:
 *           type: number
 *           description: Current price
 *         change24h:
 *           type: number
 *           description: 24-hour price change percentage
 *         volume24h:
 *           type: number
 *           description: 24-hour trading volume
 *         high24h:
 *           type: number
 *           description: 24-hour high price
 *         low24h:
 *           type: number
 *           description: 24-hour low price
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: Last price update timestamp
 *     AssetPrices:
 *       type: object
 *       properties:
 *         assetType:
 *           type: string
 *           description: Type of asset (e.g., crypto, forex, stocks)
 *         prices:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Price'
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp for all prices
 */

/**
 * @swagger
 * /prices:
 *   get:
 *     summary: Get prices for all supported assets
 *     tags: [Prices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all asset prices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 crypto:
 *                   $ref: '#/components/schemas/AssetPrices'
 *                 forex:
 *                   $ref: '#/components/schemas/AssetPrices'
 *                 stocks:
 *                   $ref: '#/components/schemas/AssetPrices'
 *       401:
 *         description: Authentication required
 */
router.get('/', auth, priceController.getAllPrices);

/**
 * @swagger
 * /prices/{assetType}:
 *   get:
 *     summary: Get prices for a specific asset type
 *     tags: [Prices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [crypto, forex, stocks]
 *         description: Type of asset to get prices for
 *     responses:
 *       200:
 *         description: Asset prices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AssetPrices'
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Invalid asset type
 */
router.get('/:assetType', auth, priceController.getAssetPrices);

module.exports = router; 