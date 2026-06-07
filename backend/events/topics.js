/**
 * Kafka Topic Definitions
 * 
 * Centralized topic configuration for event-driven architecture
 */

// Topic names
const TOPICS = {
  // Trade lifecycle events
  TRADE_CREATED: 'tradewise.trades.created',
  TRADE_UPDATED: 'tradewise.trades.updated',
  TRADE_CLOSED: 'tradewise.trades.closed',
  TRADE_DELETED: 'tradewise.trades.deleted',

  // Analysis events
  ANALYSIS_REQUESTED: 'tradewise.analysis.requested',
  ANALYSIS_COMPLETED: 'tradewise.analysis.completed',
  EMOTION_DETECTED: 'tradewise.analysis.emotion-detected',

  // Pattern detection events
  PATTERN_DETECTED: 'tradewise.patterns.detected',
  BASELINE_UPDATED: 'tradewise.patterns.baseline-updated',
  STYLE_CHANGED: 'tradewise.patterns.style-changed',

  // Alert events
  PRICE_ALERT_TRIGGERED: 'tradewise.alerts.price-triggered',
  RULE_VIOLATED: 'tradewise.alerts.rule-violated',
  TRADE_BLOCKED: 'tradewise.alerts.trade-blocked',

  // Coaching events
  BRIEFING_GENERATED: 'tradewise.coaching.briefing-generated',
  INSIGHT_GENERATED: 'tradewise.coaching.insight-generated',
  ADVICE_GENERATED: 'tradewise.coaching.advice-generated',

  // User events
  USER_REGISTERED: 'tradewise.users.registered',
  USER_SETTINGS_UPDATED: 'tradewise.users.settings-updated',
  CAPITAL_UPDATED: 'tradewise.users.capital-updated',

  // System events
  SYSTEM_HEALTH: 'tradewise.system.health',
  ERROR_OCCURRED: 'tradewise.system.errors',
  METRICS_UPDATED: 'tradewise.system.metrics',
};

// Event types for each topic
const EVENT_TYPES = {
  // Trade events
  TRADE_CREATED: 'trade.created',
  TRADE_UPDATED: 'trade.updated',
  TRADE_CLOSED: 'trade.closed',
  TRADE_DELETED: 'trade.deleted',
  TRADE_IMPORTED: 'trade.imported',

  // Analysis events
  POST_TRADE_ANALYSIS: 'analysis.post-trade',
  EMOTION_ANALYSIS: 'analysis.emotion',
  QUIZ_GENERATED: 'analysis.quiz-generated',
  FLASHCARDS_GENERATED: 'analysis.flashcards-generated',

  // Pattern events
  REVENGE_TRADING: 'pattern.revenge-trading',
  TILT_STREAK: 'pattern.tilt-streak',
  OVERTRADING: 'pattern.overtrading',
  FOMO_ENTRY: 'pattern.fomo-entry',
  POSITIVE_PATTERN: 'pattern.positive',

  // Alert events
  PRICE_ABOVE: 'alert.price-above',
  PRICE_BELOW: 'alert.price-below',
  RULE_VIOLATION: 'alert.rule-violation',
  TRADE_BLOCKED: 'alert.trade-blocked',

  // Coaching events
  PRE_MARKET_BRIEFING: 'coaching.pre-market-briefing',
  WEEKLY_INSIGHTS: 'coaching.weekly-insights',
  REAL_TIME_ADVICE: 'coaching.real-time-advice',
};

// Topic configurations
const TOPIC_CONFIGS = {
  [TOPICS.TRADE_CREATED]: {
    numPartitions: 6, // Higher for main trade events
    replicationFactor: 1, // Increase in production
    configEntries: [
      { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  [TOPICS.TRADE_UPDATED]: {
    numPartitions: 6,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) },
    ],
  },
  [TOPICS.TRADE_CLOSED]: {
    numPartitions: 6,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(30 * 24 * 60 * 60 * 1000) }, // 30 days
    ],
  },
  [TOPICS.ANALYSIS_COMPLETED]: {
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(3 * 24 * 60 * 60 * 1000) }, // 3 days
    ],
  },
  [TOPICS.PATTERN_DETECTED]: {
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(14 * 24 * 60 * 60 * 1000) }, // 14 days
    ],
  },
  [TOPICS.PRICE_ALERT_TRIGGERED]: {
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(24 * 60 * 60 * 1000) }, // 1 day
    ],
  },
  [TOPICS.RULE_VIOLATED]: {
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) },
    ],
  },
  [TOPICS.ERROR_OCCURRED]: {
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(30 * 24 * 60 * 60 * 1000) }, // 30 days for errors
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
};

// Consumer group IDs
const CONSUMER_GROUPS = {
  // Analysis consumers
  AI_ANALYSIS: 'tradewise-ai-analysis',
  EMOTION_DETECTION: 'tradewise-emotion-detection',
  POST_TRADE_ANALYSIS: 'tradewise-post-trade-analysis',

  // Pattern detection consumers
  PATTERN_DETECTION: 'tradewise-pattern-detection',
  BASELINE_CALCULATOR: 'tradewise-baseline-calculator',

  // Alert consumers
  ALERT_HANDLER: 'tradewise-alert-handler',
  RULE_ENFORCEMENT: 'tradewise-rule-enforcement',

  // Notification consumers
  EMAIL_NOTIFICATIONS: 'tradewise-email-notifications',
  PUSH_NOTIFICATIONS: 'tradewise-push-notifications',

  // Analytics consumers
  METRICS_AGGREGATOR: 'tradewise-metrics-aggregator',
  EVENT_LOGGER: 'tradewise-event-logger',
};

/**
 * Create event payload with standard structure
 */
function createEvent(type, data, metadata = {}) {
  return {
    type,
    data,
    metadata: {
      version: '1.0',
      correlationId: metadata.correlationId || generateCorrelationId(),
      causationId: metadata.causationId,
      userId: metadata.userId,
      tradeId: metadata.tradeId,
      source: metadata.source || 'api',
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

/**
 * Generate correlation ID for event tracing
 */
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create trade event
 */
function createTradeEvent(type, trade, userId, metadata = {}) {
  return createEvent(type, {
    tradeId: trade._id?.toString() || trade.id,
    userId: userId?.toString() || trade.userId?.toString(),
    symbol: trade.symbol,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    result: trade.result,
    profitLoss: trade.profitLoss,
    emotionAnalysis: trade.emotionAnalysis,
    tags: trade.tags,
    tradeDate: trade.tradeDate,
  }, {
    ...metadata,
    userId: userId?.toString() || trade.userId?.toString(),
    tradeId: trade._id?.toString() || trade.id,
  });
}

/**
 * Create pattern event
 */
function createPatternEvent(patternType, data, userId, metadata = {}) {
  return createEvent(`pattern.${patternType.toLowerCase()}`, {
    patternType,
    ...data,
  }, {
    ...metadata,
    userId: userId?.toString(),
  });
}

/**
 * Create alert event
 */
function createAlertEvent(alertType, data, userId, metadata = {}) {
  return createEvent(`alert.${alertType}`, data, {
    ...metadata,
    userId: userId?.toString(),
  });
}

module.exports = {
  TOPICS,
  EVENT_TYPES,
  TOPIC_CONFIGS,
  CONSUMER_GROUPS,
  createEvent,
  createTradeEvent,
  createPatternEvent,
  createAlertEvent,
  generateCorrelationId,
};
