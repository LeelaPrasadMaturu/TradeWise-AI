const axios = require('axios');

class PriceService {
  constructor() {
    this.priceCache = new Map();
    this.cacheDuration = 60000; // 1 minute cache
  }

  async getCryptoPrices(symbols = ['bitcoin', 'ethereum']) {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbols.join(',')}&vs_currencies=usd`
      );
      
      return Object.entries(response.data).map(([id, data]) => ({
        symbol: id,
        assetType: 'crypto',
        price: data.usd,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      throw new Error('Failed to fetch cryptocurrency prices');
    }
  }

  // TODO: Implement other asset types
  async getStockPrices(symbols) {
    // TODO: Implement stock price fetching
    return [];
  }

  async getForexPrices(symbols) {
    // TODO: Implement forex price fetching
    return [];
  }

  async getCommodityPrices(symbols) {
    // TODO: Implement commodity price fetching
    return [];
  }

  async getAllPrices() {
    try {
      // Get crypto prices (implemented)
      const cryptoPrices = await this.getCryptoPrices();
      
      // TODO: Implement other asset types
      const stockPrices = await this.getStockPrices();
      const forexPrices = await this.getForexPrices();
      const commodityPrices = await this.getCommodityPrices();

      return {
        crypto: cryptoPrices,
        stocks: stockPrices,
        forex: forexPrices,
        commodities: commodityPrices,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching all prices:', error);
      throw new Error('Failed to fetch asset prices');
    }
  }
}

module.exports = new PriceService(); 