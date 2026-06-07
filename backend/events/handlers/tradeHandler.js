/**
 * Trade Event Handler
 * 
 * Processes trade-related Kafka events:
 * - Trade created -> Trigger analysis
 * - Trade closed -> Generate post-trade analysis
 * - Trade imported -> Batch processing
 */

const { TOPICS, EVENT_TYPES, CONSUMER_GROUPS, createPatternEvent } = require('../topics');
const { createConsumer, publishEvent } = require('../kafkaClient');
const { addAIAnalysisJob, addPatternDetectionJob, JOB_TYPES } = require('../../queues');

// Lazy load services
let emotionDetectService;
let postTradeAnalysisService;
let behavioralPatternService;
let Trade;

const loadServices = () => {
  if (!emotionDetectService) {
    emotionDetectService = require('../../services/emotionDetectService');
    postTradeAnalysisService = require('../../services/postTradeAnalysisService');
    behavioralPatternService = require('../../services/behavioralPatternService');
    Trade = require('../../models/Trade');
  }
};

/**
 * Handle trade created event
 */
async function handleTradeCreated(message) {
  const { event, offset } = message;
  const { data, metadata } = event;
  
  console.log(`[TradeHandler] Processing trade.created: ${data.tradeId}`);
  loadServices();

  try {
    // 1. Queue emotion detection if reason provided
    if (data.reason || data.entryReason) {
      await addAIAnalysisJob(JOB_TYPES.EMOTION_DETECTION, {
        tradeId: data.tradeId,
        text: data.reason || data.entryReason,
        userId: data.userId,
      });
    }

    // 2. Queue behavioral pattern detection
    await addPatternDetectionJob(JOB_TYPES.BEHAVIORAL_ANALYSIS, {
      userId: data.userId,
      tradeId: data.tradeId,
      trigger: 'trade_created',
    });

    // 3. Check for immediate patterns (revenge trading, etc.)
    const immediatePatterns = await checkImmediatePatterns(data);
    
    // Publish pattern events
    for (const pattern of immediatePatterns) {
      await publishEvent(TOPICS.PATTERN_DETECTED, createPatternEvent(
        pattern.type,
        pattern,
        data.userId,
        { correlationId: metadata.correlationId }
      ));
    }

    console.log(`[TradeHandler] Trade ${data.tradeId} processed, ${immediatePatterns.length} immediate patterns detected`);

    return { success: true, patterns: immediatePatterns.length };
  } catch (error) {
    console.error(`[TradeHandler] Error processing trade.created:`, error.message);
    
    // Publish error event
    await publishEvent(TOPICS.ERROR_OCCURRED, {
      type: 'trade.created.error',
      data: {
        tradeId: data.tradeId,
        error: error.message,
      },
      metadata: { correlationId: metadata.correlationId },
    });

    throw error;
  }
}

/**
 * Handle trade closed event
 */
async function handleTradeClosed(message) {
  const { event } = message;
  const { data, metadata } = event;
  
  console.log(`[TradeHandler] Processing trade.closed: ${data.tradeId}`);
  loadServices();

  try {
    // 1. Queue post-trade analysis
    await addAIAnalysisJob(JOB_TYPES.POST_TRADE_ANALYSIS, {
      tradeId: data.tradeId,
      userId: data.userId,
      tradeData: data,
    }, { priority: 1 }); // High priority for closed trades

    // 2. Detect exit emotion if provided
    if (data.exitReason) {
      await addAIAnalysisJob(JOB_TYPES.EMOTION_DETECTION, {
        tradeId: data.tradeId,
        exitText: data.exitReason,
        userId: data.userId,
      });
    }

    // 3. Update baseline after trade closes
    await addPatternDetectionJob(JOB_TYPES.BASELINE_RECALCULATION, {
      userId: data.userId,
      trigger: 'trade_closed',
    }, { delay: 5000 }); // Delay to ensure trade is saved

    // 4. Calculate discipline score if rules were checked
    if (data.disciplineScore !== undefined) {
      await addPatternDetectionJob(JOB_TYPES.DISCIPLINE_SCORE, {
        userId: data.userId,
        period: '7d',
      });
    }

    console.log(`[TradeHandler] Trade ${data.tradeId} close processed`);

    return { success: true };
  } catch (error) {
    console.error(`[TradeHandler] Error processing trade.closed:`, error.message);
    throw error;
  }
}

/**
 * Handle trade updated event
 */
async function handleTradeUpdated(message) {
  const { event } = message;
  const { data, metadata } = event;
  
  console.log(`[TradeHandler] Processing trade.updated: ${data.tradeId}`);
  loadServices();

  try {
    // Re-run emotion detection if reason was updated
    if (data.updatedFields?.includes('reason')) {
      const trade = await Trade.findById(data.tradeId).lean();
      if (trade?.reason) {
        await addAIAnalysisJob(JOB_TYPES.EMOTION_DETECTION, {
          tradeId: data.tradeId,
          text: trade.reason,
          userId: data.userId,
        });
      }
    }

    // Re-run analysis if exit data was updated
    if (data.updatedFields?.some(f => ['exitPrice', 'exitReason', 'result', 'profitLoss'].includes(f))) {
      await addAIAnalysisJob(JOB_TYPES.POST_TRADE_ANALYSIS, {
        tradeId: data.tradeId,
        userId: data.userId,
      });
    }

    return { success: true };
  } catch (error) {
    console.error(`[TradeHandler] Error processing trade.updated:`, error.message);
    throw error;
  }
}

/**
 * Check for immediate patterns (run synchronously for real-time feedback)
 */
async function checkImmediatePatterns(tradeData) {
  loadServices();
  const patterns = [];

  try {
    // Check for revenge trading (quick re-entry after loss)
    const revengeCheck = await behavioralPatternService.checkRevengeTrading(
      tradeData.userId,
      tradeData.tradeDate || new Date()
    );
    
    if (revengeCheck?.detected) {
      patterns.push({
        type: 'REVENGE_TRADING',
        severity: 'high',
        ...revengeCheck,
      });
    }

    // Check for overtrading
    const overtradingCheck = await behavioralPatternService.checkOvertrading(
      tradeData.userId,
      tradeData.tradeDate || new Date()
    );
    
    if (overtradingCheck?.detected) {
      patterns.push({
        type: 'OVERTRADING',
        severity: overtradingCheck.severity || 'medium',
        ...overtradingCheck,
      });
    }

    // Check for FOMO in reason
    if (tradeData.reason) {
      const fomoKeywords = ['fomo', 'missing out', 'fear of missing', 'everyone is', 'quick money'];
      const reasonLower = tradeData.reason.toLowerCase();
      
      if (fomoKeywords.some(kw => reasonLower.includes(kw))) {
        patterns.push({
          type: 'FOMO_ENTRY',
          severity: 'medium',
          reason: tradeData.reason,
          keywords: fomoKeywords.filter(kw => reasonLower.includes(kw)),
        });
      }
    }

    // Check for negative emotion
    if (tradeData.preTradeEmotion) {
      const negativeEmotions = ['anxious', 'fearful', 'angry', 'frustrated', 'revenge', 'fomo'];
      if (negativeEmotions.includes(tradeData.preTradeEmotion.toLowerCase())) {
        patterns.push({
          type: 'NEGATIVE_EMOTION_TRADING',
          severity: 'medium',
          emotion: tradeData.preTradeEmotion,
        });
      }
    }
  } catch (error) {
    console.error('[TradeHandler] Error checking immediate patterns:', error.message);
  }

  return patterns;
}

/**
 * Start trade event consumer
 */
async function startTradeConsumer() {
  const topics = [
    TOPICS.TRADE_CREATED,
    TOPICS.TRADE_UPDATED,
    TOPICS.TRADE_CLOSED,
  ];

  const handler = async (message) => {
    const { topic, event } = message;
    
    switch (event.type) {
      case EVENT_TYPES.TRADE_CREATED:
        return handleTradeCreated(message);
      
      case EVENT_TYPES.TRADE_CLOSED:
        return handleTradeClosed(message);
      
      case EVENT_TYPES.TRADE_UPDATED:
        return handleTradeUpdated(message);
      
      default:
        console.log(`[TradeHandler] Unknown event type: ${event.type}`);
    }
  };

  return createConsumer(
    CONSUMER_GROUPS.AI_ANALYSIS,
    topics,
    handler,
    {
      fromBeginning: false,
      autoCommit: true,
    }
  );
}

module.exports = {
  startTradeConsumer,
  handleTradeCreated,
  handleTradeClosed,
  handleTradeUpdated,
  checkImmediatePatterns,
};
