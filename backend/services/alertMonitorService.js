const axios = require('axios');
const TradeAlert = require('../models/TradeAlert');
const User = require('../models/User');
const { sendTradeAlertEmail } = require('./emailService');
// // const { sendTelegramMessage } = require('./telegramService');
// const { sendSMS } = require('./smsService');

class AlertMonitorService {
  constructor() {
    this.priceUpdateInterval = 60000; // 1 minute
    this.isRunning = false;
    this.priceCache = new Map();
  }

  async startMonitoring() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.monitorLoop();
  }

  async stopMonitoring() {
    this.isRunning = false;
  }

  async monitorLoop() {
    while (this.isRunning) {
      try {
        await this.checkAllAlerts();
        await new Promise(resolve => setTimeout(resolve, this.priceUpdateInterval));
      } catch (error) {
        console.error('Error in monitor loop:', error);
        // Wait a bit longer on error before retrying
        await new Promise(resolve => setTimeout(resolve, this.priceUpdateInterval * 2));
      }
    }
  }

  async checkAllAlerts() {
    const activeAlerts = await TradeAlert.find({ status: 'active' });
    
    for (const alert of activeAlerts) {
      try {
        const currentPrice = await this.getCurrentPrice(alert.symbol, alert.assetType);
        
        if (this.shouldTriggerAlert(alert, currentPrice)) {
          await this.triggerAlert(alert, currentPrice);
        }

        // Update last checked time
        alert.lastChecked = new Date();
        alert.currentPrice = currentPrice;
        await alert.save();
      } catch (error) {
        console.error(`Error checking alert ${alert._id}:`, error);
      }
    }
  }

  async getCurrentPrice(symbol, assetType) {
    // Check cache first
    const cacheKey = `${assetType}:${symbol}`;
    const cachedPrice = this.priceCache.get(cacheKey);
    if (cachedPrice && Date.now() - cachedPrice.timestamp < 60000) {
      return cachedPrice.price;
    }

    // Fetch from appropriate API based on asset type
    let price;
    switch (assetType) {
      case 'crypto':
        price = await this.getCryptoPrice(symbol);
        break;
      case 'stock':
        price = await this.getStockPrice(symbol);
        break;
      case 'forex':
        price = await this.getForexPrice(symbol);
        break;
      case 'commodity':
        price = await this.getCommodityPrice(symbol);
        break;
      default:
        throw new Error(`Unsupported asset type: ${assetType}`);
    }

    // Update cache
    this.priceCache.set(cacheKey, {
      price,
      timestamp: Date.now()
    });

    return price;
  }

  shouldTriggerAlert(alert, currentPrice) {
    switch (alert.triggerType) {
      case 'price_above':
        return currentPrice > alert.triggerValue;
      case 'price_below':
        return currentPrice < alert.triggerValue;
      case 'percentage_change':
        const percentageChange = ((currentPrice - alert.currentPrice) / alert.currentPrice) * 100;
        return Math.abs(percentageChange) >= alert.triggerValue;
      case 'volume_spike':
        // Implement volume spike detection logic
        return false;
      default:
        return false;
    }
  }

  async triggerAlert(alert, currentPrice) {
    // Update alert status
    alert.status = 'triggered';
    alert.triggeredAt = new Date();
    await alert.save();

    // Get user details
    const user = await User.findById(alert.user);
    if (!user) return;

    // Send notifications through enabled channels
    if (alert.notificationChannels.email) {
      try {
        await sendTradeAlertEmail(user, alert, currentPrice);
      } catch (error) {
        console.error('Error sending email notification:', error);
      }
    }

    if (alert.notificationChannels.telegram && user.alertPreferences.telegram) {
      try {
        await sendTelegramMessage(user.telegramId, this.createAlertMessage(alert, currentPrice));
      } catch (error) {
        console.error('Error sending Telegram notification:', error);
      }
    }

    if (alert.notificationChannels.sms && user.alertPreferences.sms) {
      try {
        await sendSMS(user.phone, this.createAlertMessage(alert, currentPrice));
      } catch (error) {
        console.error('Error sending SMS notification:', error);
      }
    }
  }

  createAlertMessage(alert, currentPrice) {
    return `
Trade Alert Triggered!

Symbol: ${alert.symbol}
Asset Type: ${alert.assetType}
Current Price: ${currentPrice}
Trigger Type: ${alert.triggerType}
Trigger Value: ${alert.triggerValue}
Description: ${alert.description || 'No description provided'}

Time: ${new Date().toLocaleString()}
    `.trim();
  }

  // API methods for different asset types
  async getCryptoPrice(symbol) {
    // Implement crypto price fetching
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`);
    return response.data[symbol].usd;
  }

  async getStockPrice(symbol) {
    // Implement stock price fetching
    const response = await axios.get(`https://api.example.com/stocks/${symbol}/price`);
    return response.data.price;
  }

  async getForexPrice(symbol) {
    // Implement forex price fetching
    const response = await axios.get(`https://api.example.com/forex/${symbol}/price`);
    return response.data.price;
  }

  async getCommodityPrice(symbol) {
    // Implement commodity price fetching
    const response = await axios.get(`https://api.example.com/commodities/${symbol}/price`);
    return response.data.price;
  }
}

// Create singleton instance
const alertMonitorService = new AlertMonitorService();

module.exports = alertMonitorService; 