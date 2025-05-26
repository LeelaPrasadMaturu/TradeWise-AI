const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');
const auth = require('../middlewares/authMiddleware');

// All routes are protected
router.use(auth);

// Get prices for all assets
router.get('/', priceController.getAllPrices);

// Get prices for specific asset type
router.get('/:assetType', priceController.getAssetPrices);

module.exports = router; 