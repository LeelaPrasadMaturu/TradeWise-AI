/**
 * Alert Event Handler
 * 
 * Processes alert-related Kafka events:
 * - Price alerts triggered
 * - Rule violations
 * - Trade blocked events
 */

const { TOPICS, EVENT_TYPES, CONSUMER_GROUPS } = require('../topics');
const { createConsumer, publishEvent } = require('../kafkaClient');
const { addEmailJob, JOB_TYPES } = require('../../queues');

// Lazy load models
let User;
let TradeAlert;

const loadModels = () => {
  if (!User) {
    User = require('../../models/User');
    TradeAlert = require('../../models/TradeAlert');
  }
};

/**
 * Handle price alert triggered event
 */
async function handlePriceAlertTriggered(message) {
  const { event } = message;
  const { data, metadata } = event;
  
  console.log(`[AlertHandler] Processing price alert: ${data.alertId}`);
  loadModels();

  try {
    // Get user for notification preferences
    const user = await User.findById(data.userId).lean();
    
    if (!user) {
      console.warn(`[AlertHandler] User not found for alert ${data.alertId}`);
      return { success: false, reason: 'user_not_found' };
    }

    // Check notification preferences
    const shouldEmail = user.alertPreferences?.email !== false;
    
    if (shouldEmail && user.email) {
      // Queue email notification
      await addEmailJob(JOB_TYPES.PRICE_ALERT, {
        email: user.email,
        name: user.name,
        symbol: data.symbol,
        triggerType: data.triggerType,
        triggerValue: data.triggerValue,
        currentPrice: data.currentPrice,
        alertId: data.alertId,
      });
    }

    // Update alert status
    await TradeAlert.findByIdAndUpdate(data.alertId, {
      triggered: true,
      triggeredAt: new Date(),
      triggeredPrice: data.currentPrice,
    });

    console.log(`[AlertHandler] Price alert ${data.alertId} notification queued`);

    return { success: true, emailQueued: shouldEmail };
  } catch (error) {
    console.error(`[AlertHandler] Error processing price alert:`, error.message);
    throw error;
  }
}

/**
 * Handle rule violation event
 */
async function handleRuleViolation(message) {
  const { event } = message;
  const { data, metadata } = event;
  
  console.log(`[AlertHandler] Processing rule violation for user ${data.userId}`);
  loadModels();

  try {
    // Get user for notification
    const user = await User.findById(data.userId).lean();
    
    if (!user) {
      console.warn(`[AlertHandler] User not found: ${data.userId}`);
      return { success: false, reason: 'user_not_found' };
    }

    // Check if user wants violation notifications
    const shouldNotify = user.coachingPreferences?.enableRealTimeAlerts !== false;
    
    if (shouldNotify && user.email) {
      // Queue violation notification
      await addEmailJob(JOB_TYPES.RULE_VIOLATION_ALERT, {
        email: user.email,
        name: user.name,
        violations: data.violations,
        tradeDetails: data.tradeDetails,
        severity: data.severity,
      });
    }

    // Log violation for analytics
    console.log(`[AlertHandler] Rule violation processed:`, {
      userId: data.userId,
      rules: data.violations?.length || 0,
      severity: data.severity,
    });

    return { success: true, notificationSent: shouldNotify };
  } catch (error) {
    console.error(`[AlertHandler] Error processing rule violation:`, error.message);
    throw error;
  }
}

/**
 * Handle trade blocked event
 */
async function handleTradeBlocked(message) {
  const { event } = message;
  const { data, metadata } = event;
  
  console.log(`[AlertHandler] Processing trade blocked for user ${data.userId}`);
  loadModels();

  try {
    // Get user
    const user = await User.findById(data.userId).lean();
    
    if (!user) {
      return { success: false, reason: 'user_not_found' };
    }

    // Log blocked trade for analytics
    // This could be stored in a separate collection for tracking blocked attempts
    console.log(`[AlertHandler] Trade blocked:`, {
      userId: data.userId,
      symbol: data.symbol,
      blockReasons: data.blockReasons,
      score: data.disciplineScore,
    });

    // Optional: Send notification about blocked trade
    // Most users probably don't want this, but could be configurable

    return { success: true };
  } catch (error) {
    console.error(`[AlertHandler] Error processing trade blocked:`, error.message);
    throw error;
  }
}

/**
 * Start alert event consumer
 */
async function startAlertConsumer() {
  const topics = [
    TOPICS.PRICE_ALERT_TRIGGERED,
    TOPICS.RULE_VIOLATED,
    TOPICS.TRADE_BLOCKED,
  ];

  const handler = async (message) => {
    const { event } = message;
    
    switch (event.type) {
      case EVENT_TYPES.PRICE_ABOVE:
      case EVENT_TYPES.PRICE_BELOW:
        return handlePriceAlertTriggered(message);
      
      case EVENT_TYPES.RULE_VIOLATION:
        return handleRuleViolation(message);
      
      case EVENT_TYPES.TRADE_BLOCKED:
        return handleTradeBlocked(message);
      
      default:
        console.log(`[AlertHandler] Unknown event type: ${event.type}`);
    }
  };

  return createConsumer(
    CONSUMER_GROUPS.ALERT_HANDLER,
    topics,
    handler,
    {
      fromBeginning: false,
      autoCommit: true,
    }
  );
}

module.exports = {
  startAlertConsumer,
  handlePriceAlertTriggered,
  handleRuleViolation,
  handleTradeBlocked,
};
