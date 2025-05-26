const priceService = require('../services/priceService');

// Get prices for all assets
exports.getAllPrices = async (req, res) => {
  try {
    const prices = await priceService.getAllPrices();
    res.status(200).json({
      success: true,
      data: prices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get prices for specific asset type
exports.getAssetPrices = async (req, res) => {
  try {
    const { assetType } = req.params;
    const { symbols } = req.query;

    let prices;
    switch (assetType) {
      case 'crypto':
        prices = await priceService.getCryptoPrices(symbols ? symbols.split(',') : undefined);
        break;
      case 'stocks':
        prices = await priceService.getStockPrices(symbols ? symbols.split(',') : undefined);
        break;
      case 'forex':
        prices = await priceService.getForexPrices(symbols ? symbols.split(',') : undefined);
        break;
      case 'commodities':
        prices = await priceService.getCommodityPrices(symbols ? symbols.split(',') : undefined);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid asset type'
        });
    }

    res.status(200).json({
      success: true,
      data: prices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 