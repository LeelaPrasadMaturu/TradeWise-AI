/**
 * Email Delivery Worker
 * 
 * Processes email delivery jobs:
 * - Pre-market briefings
 * - Weekly reports
 * - Price alerts
 * - Rule violation alerts
 */

const { Worker } = require('bullmq');
const Redis = require('ioredis');
const nodemailer = require('nodemailer');
const { QUEUE_NAMES, JOB_TYPES } = require('../index');

// Lazy load services
let tradingCoachService;
let User;

const loadServices = () => {
  if (!tradingCoachService) {
    tradingCoachService = require('../../services/tradingCoachService');
    User = require('../../models/User');
  }
};

// Redis connection
const createConnection = () => {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_QUEUE_DB, 10) || 1,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

// Email transporter (singleton)
let transporter = null;

const getTransporter = () => {
  if (!transporter && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10, // 10 emails per second
    });
  }
  return transporter;
};

// Worker instance
let worker = null;

/**
 * Process email delivery jobs
 */
async function processJob(job) {
  loadServices();
  
  const { name, data } = job;
  
  console.log(`[EmailWorker] Processing job ${job.id}: ${name}`);

  try {
    switch (name) {
      case JOB_TYPES.PRE_MARKET_BRIEFING:
        return await sendPreMarketBriefing(job, data);

      case JOB_TYPES.WEEKLY_REPORT:
        return await sendWeeklyReport(job, data);

      case JOB_TYPES.PRICE_ALERT:
        return await sendPriceAlert(job, data);

      case JOB_TYPES.RULE_VIOLATION_ALERT:
        return await sendRuleViolationAlert(job, data);

      default:
        throw new Error(`Unknown job type: ${name}`);
    }
  } catch (error) {
    console.error(`[EmailWorker] Job ${job.id} failed:`, error.message);
    throw error;
  }
}

/**
 * Send pre-market briefing email
 */
async function sendPreMarketBriefing(job, data) {
  const { userId, email, name } = data;

  await job.updateProgress(10);

  // Generate briefing
  const briefing = await tradingCoachService.generatePreMarketBriefing(userId);
  await job.updateProgress(50);

  // Format as HTML
  const html = tradingCoachService.formatBriefingAsEmail(briefing, name);
  await job.updateProgress(70);

  // Send email
  const transport = getTransporter();
  if (!transport) {
    console.log(`[EmailWorker] SMTP not configured, logging briefing for ${email}`);
    return { sent: false, method: 'logged', email };
  }

  const result = await transport.sendMail({
    from: process.env.SMTP_FROM || '"TradeWise AI" <coach@tradewise.ai>',
    to: email,
    subject: `${briefing.greeting}! Your Pre-Market Briefing - ${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}`,
    html,
  });

  await job.updateProgress(100);

  return {
    sent: true,
    method: 'email',
    email,
    messageId: result.messageId,
  };
}

/**
 * Send weekly report email
 */
async function sendWeeklyReport(job, data) {
  const { userId, email, name, insights } = data;

  await job.updateProgress(10);

  const html = formatWeeklyReportEmail(insights, name);
  await job.updateProgress(50);

  const transport = getTransporter();
  if (!transport) {
    console.log(`[EmailWorker] SMTP not configured, logging report for ${email}`);
    return { sent: false, method: 'logged', email };
  }

  const result = await transport.sendMail({
    from: process.env.SMTP_FROM || '"TradeWise AI" <coach@tradewise.ai>',
    to: email,
    subject: `Your Weekly Trading Report - Week ${getWeekNumber(new Date())}`,
    html,
  });

  await job.updateProgress(100);

  return {
    sent: true,
    method: 'email',
    email,
    messageId: result.messageId,
  };
}

/**
 * Send price alert email
 */
async function sendPriceAlert(job, data) {
  const { email, symbol, triggerType, triggerValue, currentPrice, alertId } = data;

  await job.updateProgress(10);

  const html = formatPriceAlertEmail({
    symbol,
    triggerType,
    triggerValue,
    currentPrice,
  });

  await job.updateProgress(50);

  const transport = getTransporter();
  if (!transport) {
    console.log(`[EmailWorker] Price alert logged for ${email}: ${symbol}`);
    return { sent: false, method: 'logged', email };
  }

  const triggerDescription = triggerType === 'price_above' ? 'above' : 'below';

  const result = await transport.sendMail({
    from: process.env.SMTP_FROM || '"TradeWise AI" <alerts@tradewise.ai>',
    to: email,
    subject: `🚨 Price Alert: ${symbol} is ${triggerDescription} ${triggerValue}`,
    html,
  });

  await job.updateProgress(100);

  return {
    sent: true,
    method: 'email',
    email,
    alertId,
    messageId: result.messageId,
  };
}

/**
 * Send rule violation alert email
 */
async function sendRuleViolationAlert(job, data) {
  const { email, name, violations, tradeDetails } = data;

  await job.updateProgress(10);

  const html = formatRuleViolationEmail({
    name,
    violations,
    tradeDetails,
  });

  await job.updateProgress(50);

  const transport = getTransporter();
  if (!transport) {
    console.log(`[EmailWorker] Rule violation logged for ${email}`);
    return { sent: false, method: 'logged', email };
  }

  const result = await transport.sendMail({
    from: process.env.SMTP_FROM || '"TradeWise AI" <coach@tradewise.ai>',
    to: email,
    subject: '⚠️ Trading Rule Violation Alert',
    html,
  });

  await job.updateProgress(100);

  return {
    sent: true,
    method: 'email',
    email,
    messageId: result.messageId,
  };
}

/**
 * Format weekly report as HTML email
 */
function formatWeeklyReportEmail(insights, userName) {
  const { metrics = {}, recommendations = [], aiAnalysis = '' } = insights;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
        .metric-label { font-size: 12px; color: #666; }
        .recommendation { padding: 10px; margin: 5px 0; background: white; border-left: 4px solid #667eea; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Weekly Trading Report</h1>
          <p>Hello ${userName || 'Trader'}!</p>
        </div>
        <div class="content">
          <h2>Your Week in Numbers</h2>
          <div>
            <div class="metric">
              <div class="metric-value">${metrics.totalTrades || 0}</div>
              <div class="metric-label">Trades</div>
            </div>
            <div class="metric">
              <div class="metric-value">${metrics.winRate?.toFixed(1) || 0}%</div>
              <div class="metric-label">Win Rate</div>
            </div>
            <div class="metric">
              <div class="metric-value">₹${metrics.totalPnL?.toFixed(0) || 0}</div>
              <div class="metric-label">P&L</div>
            </div>
          </div>
          
          ${aiAnalysis ? `
          <h2>AI Analysis</h2>
          <p>${aiAnalysis}</p>
          ` : ''}
          
          ${recommendations.length > 0 ? `
          <h2>Recommendations</h2>
          ${recommendations.map(r => `<div class="recommendation">${r}</div>`).join('')}
          ` : ''}
        </div>
        <div class="footer">
          <p>TradeWise AI - Your Intelligent Trading Assistant</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format price alert as HTML email
 */
function formatPriceAlertEmail({ symbol, triggerType, triggerValue, currentPrice }) {
  const direction = triggerType === 'price_above' ? 'above' : 'below';
  const color = triggerType === 'price_above' ? '#22c55e' : '#ef4444';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert-box { background: ${color}15; border: 2px solid ${color}; border-radius: 8px; padding: 20px; text-align: center; }
        .symbol { font-size: 32px; font-weight: bold; }
        .price { font-size: 24px; color: ${color}; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="alert-box">
          <div class="symbol">${symbol}</div>
          <div class="price">Current: ₹${currentPrice?.toFixed(2) || 'N/A'}</div>
          <p>Price is now ${direction} your target of ₹${triggerValue}</p>
        </div>
        <p style="text-align: center; margin-top: 20px;">
          <small>This alert was triggered at ${new Date().toLocaleString('en-IN')}</small>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format rule violation as HTML email
 */
function formatRuleViolationEmail({ name, violations, tradeDetails }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .warning-box { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; }
        .violation { padding: 10px; margin: 5px 0; background: white; border-left: 4px solid #ef4444; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>⚠️ Trading Rule Violation</h1>
        <p>Hello ${name || 'Trader'},</p>
        <p>Your recent trade violated the following rules:</p>
        <div class="warning-box">
          ${violations.map(v => `<div class="violation">${v}</div>`).join('')}
        </div>
        ${tradeDetails ? `
        <h3>Trade Details</h3>
        <p>Symbol: ${tradeDetails.symbol}</p>
        <p>Direction: ${tradeDetails.direction}</p>
        <p>Entry: ₹${tradeDetails.entryPrice}</p>
        ` : ''}
        <p>Remember: Following your rules correlates with higher win rates!</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get ISO week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Start the email worker
 */
function startWorker(options = {}) {
  const {
    concurrency = 3,
    limiter = {
      max: 10,
      duration: 1000, // Max 10 emails per second
    },
  } = options;

  worker = new Worker(
    QUEUE_NAMES.EMAIL_DELIVERY,
    processJob,
    {
      connection: createConnection(),
      concurrency,
      limiter,
      settings: {
        stalledInterval: 60000,
        maxStalledCount: 2,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[EmailWorker] Job ${job.id} completed:`, result.email);
  });

  worker.on('failed', (job, error) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[EmailWorker] Worker error:', error.message);
  });

  console.log(`[EmailWorker] Started with concurrency ${concurrency}`);

  return worker;
}

/**
 * Stop the worker
 */
async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[EmailWorker] Stopped');
  }

  if (transporter) {
    transporter.close();
    transporter = null;
  }
}

/**
 * Get worker status
 */
function getWorkerStatus() {
  if (!worker) {
    return { running: false };
  }

  return {
    running: worker.isRunning(),
    paused: worker.isPaused(),
    name: worker.name,
    transporterReady: !!transporter,
  };
}

module.exports = {
  startWorker,
  stopWorker,
  getWorkerStatus,
  processJob,
};
