/**
 * Apache Kafka Client
 * 
 * Event streaming for distributed event-driven architecture:
 * - Producer for publishing events
 * - Consumer groups for parallel processing
 * - Automatic reconnection and error handling
 * - Exactly-once semantics support
 */

const { Kafka, logLevel, CompressionTypes, Partitioners } = require('kafkajs');

// Kafka configuration
const getKafkaConfig = () => ({
  clientId: process.env.KAFKA_CLIENT_ID || 'tradewise-api',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_SASL_USERNAME ? {
    mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD,
  } : undefined,
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
    factor: 2,
    multiplier: 1.5,
  },
  logLevel: process.env.NODE_ENV === 'production' ? logLevel.WARN : logLevel.INFO,
});

// Singleton instances
let kafka = null;
let producer = null;
let consumers = new Map();
let admin = null;
let isConnected = false;

/**
 * Initialize Kafka client
 */
async function initializeKafka() {
  if (kafka) return { kafka, producer, admin };

  try {
    kafka = new Kafka(getKafkaConfig());
    
    // Initialize producer
    producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
      idempotent: true, // Enable exactly-once semantics
      maxInFlightRequests: 5,
    });

    // Initialize admin client
    admin = kafka.admin();

    await producer.connect();
    await admin.connect();
    
    isConnected = true;
    console.log('[Kafka] Connected successfully');

    // Setup event handlers
    setupProducerEvents();

    return { kafka, producer, admin };
  } catch (error) {
    console.error('[Kafka] Connection failed:', error.message);
    isConnected = false;
    throw error;
  }
}

/**
 * Setup producer event handlers
 */
function setupProducerEvents() {
  producer.on('producer.connect', () => {
    console.log('[Kafka] Producer connected');
    isConnected = true;
  });

  producer.on('producer.disconnect', () => {
    console.log('[Kafka] Producer disconnected');
    isConnected = false;
  });

  producer.on('producer.network.request_timeout', (payload) => {
    console.error('[Kafka] Producer request timeout:', payload);
  });
}

/**
 * Publish event to Kafka topic
 */
async function publishEvent(topic, event, options = {}) {
  if (!producer || !isConnected) {
    console.warn('[Kafka] Producer not connected, event not published:', topic);
    return { success: false, reason: 'not_connected' };
  }

  const {
    key = null,
    partition = null,
    headers = {},
    compress = true,
  } = options;

  const message = {
    key: key ? String(key) : null,
    value: JSON.stringify({
      ...event,
      timestamp: Date.now(),
      source: process.env.KAFKA_CLIENT_ID || 'tradewise-api',
    }),
    headers: {
      'content-type': 'application/json',
      'event-type': event.type || topic,
      ...headers,
    },
    partition,
  };

  try {
    const result = await producer.send({
      topic,
      messages: [message],
      compression: compress ? CompressionTypes.GZIP : CompressionTypes.None,
    });

    console.log(`[Kafka] Event published to ${topic}:`, event.type || 'unknown');
    
    return {
      success: true,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    };
  } catch (error) {
    console.error(`[Kafka] Failed to publish to ${topic}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Publish multiple events in a batch
 */
async function publishBatch(messages) {
  if (!producer || !isConnected) {
    console.warn('[Kafka] Producer not connected, batch not published');
    return { success: false, reason: 'not_connected' };
  }

  const topicMessages = {};
  
  // Group messages by topic
  for (const { topic, event, key, headers } of messages) {
    if (!topicMessages[topic]) {
      topicMessages[topic] = [];
    }
    
    topicMessages[topic].push({
      key: key ? String(key) : null,
      value: JSON.stringify({
        ...event,
        timestamp: Date.now(),
        source: process.env.KAFKA_CLIENT_ID || 'tradewise-api',
      }),
      headers: {
        'content-type': 'application/json',
        'event-type': event.type || topic,
        ...headers,
      },
    });
  }

  try {
    const result = await producer.sendBatch({
      topicMessages: Object.entries(topicMessages).map(([topic, messages]) => ({
        topic,
        messages,
      })),
      compression: CompressionTypes.GZIP,
    });

    console.log(`[Kafka] Batch published: ${messages.length} messages`);
    
    return {
      success: true,
      results: result,
    };
  } catch (error) {
    console.error('[Kafka] Batch publish failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create a consumer for a topic
 */
async function createConsumer(groupId, topics, handler, options = {}) {
  if (!kafka) {
    throw new Error('Kafka not initialized');
  }

  const consumerKey = `${groupId}:${topics.join(',')}`;
  
  if (consumers.has(consumerKey)) {
    console.log(`[Kafka] Consumer already exists for ${consumerKey}`);
    return consumers.get(consumerKey);
  }

  const {
    fromBeginning = false,
    autoCommit = true,
    autoCommitInterval = 5000,
    sessionTimeout = 30000,
    rebalanceTimeout = 60000,
    heartbeatInterval = 3000,
    maxBytesPerPartition = 1048576, // 1MB
    maxWaitTimeInMs = 5000,
  } = options;

  const consumer = kafka.consumer({
    groupId,
    sessionTimeout,
    rebalanceTimeout,
    heartbeatInterval,
    maxBytesPerPartition,
    maxWaitTimeInMs,
  });

  await consumer.connect();
  
  // Subscribe to topics
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning });
  }

  // Setup event handlers
  consumer.on('consumer.connect', () => {
    console.log(`[Kafka] Consumer ${groupId} connected`);
  });

  consumer.on('consumer.disconnect', () => {
    console.log(`[Kafka] Consumer ${groupId} disconnected`);
  });

  consumer.on('consumer.crash', (event) => {
    console.error(`[Kafka] Consumer ${groupId} crashed:`, event.payload.error);
  });

  consumer.on('consumer.rebalancing', () => {
    console.log(`[Kafka] Consumer ${groupId} rebalancing`);
  });

  // Start consuming
  await consumer.run({
    autoCommit,
    autoCommitInterval,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        const headers = {};
        
        for (const [key, value] of Object.entries(message.headers || {})) {
          headers[key] = value?.toString();
        }

        await handler({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString(),
          event,
          headers,
          timestamp: message.timestamp,
        });
      } catch (error) {
        console.error(`[Kafka] Error processing message from ${topic}:`, error.message);
        // Don't throw - let autocommit continue for other messages
      }
    },
  });

  consumers.set(consumerKey, consumer);
  console.log(`[Kafka] Consumer ${groupId} started for topics: ${topics.join(', ')}`);

  return consumer;
}

/**
 * Create topic if it doesn't exist
 */
async function ensureTopic(topic, config = {}) {
  if (!admin) {
    throw new Error('Kafka admin not initialized');
  }

  const {
    numPartitions = 3,
    replicationFactor = 1,
    configEntries = [],
  } = config;

  try {
    const existingTopics = await admin.listTopics();
    
    if (existingTopics.includes(topic)) {
      console.log(`[Kafka] Topic ${topic} already exists`);
      return { created: false, exists: true };
    }

    await admin.createTopics({
      topics: [{
        topic,
        numPartitions,
        replicationFactor,
        configEntries,
      }],
    });

    console.log(`[Kafka] Topic ${topic} created`);
    return { created: true, exists: true };
  } catch (error) {
    console.error(`[Kafka] Failed to create topic ${topic}:`, error.message);
    throw error;
  }
}

/**
 * Get topic metadata
 */
async function getTopicMetadata(topics = []) {
  if (!admin) {
    throw new Error('Kafka admin not initialized');
  }

  try {
    const metadata = await admin.fetchTopicMetadata({ topics });
    return metadata;
  } catch (error) {
    console.error('[Kafka] Failed to fetch topic metadata:', error.message);
    throw error;
  }
}

/**
 * Get consumer group offsets
 */
async function getConsumerOffsets(groupId, topic) {
  if (!admin) {
    throw new Error('Kafka admin not initialized');
  }

  try {
    const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
    return offsets;
  } catch (error) {
    console.error('[Kafka] Failed to fetch consumer offsets:', error.message);
    throw error;
  }
}

/**
 * Get Kafka connection status
 */
function getStatus() {
  return {
    connected: isConnected,
    producerReady: !!producer,
    adminReady: !!admin,
    activeConsumers: consumers.size,
    consumerGroups: Array.from(consumers.keys()),
  };
}

/**
 * Health check
 */
async function healthCheck() {
  if (!isConnected || !admin) {
    return { healthy: false, reason: 'not_connected' };
  }

  try {
    const cluster = await admin.describeCluster();
    return {
      healthy: true,
      brokers: cluster.brokers.length,
      controllerId: cluster.controller,
    };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

/**
 * Graceful shutdown
 */
async function disconnect() {
  console.log('[Kafka] Disconnecting...');

  // Disconnect all consumers
  for (const [key, consumer] of consumers) {
    try {
      await consumer.disconnect();
      console.log(`[Kafka] Consumer ${key} disconnected`);
    } catch (error) {
      console.error(`[Kafka] Error disconnecting consumer ${key}:`, error.message);
    }
  }
  consumers.clear();

  // Disconnect producer
  if (producer) {
    try {
      await producer.disconnect();
      console.log('[Kafka] Producer disconnected');
    } catch (error) {
      console.error('[Kafka] Error disconnecting producer:', error.message);
    }
    producer = null;
  }

  // Disconnect admin
  if (admin) {
    try {
      await admin.disconnect();
      console.log('[Kafka] Admin disconnected');
    } catch (error) {
      console.error('[Kafka] Error disconnecting admin:', error.message);
    }
    admin = null;
  }

  kafka = null;
  isConnected = false;
  console.log('[Kafka] Disconnected');
}

module.exports = {
  initializeKafka,
  publishEvent,
  publishBatch,
  createConsumer,
  ensureTopic,
  getTopicMetadata,
  getConsumerOffsets,
  getStatus,
  healthCheck,
  disconnect,
  
  // Direct access
  getProducer: () => producer,
  getAdmin: () => admin,
  getKafka: () => kafka,
};
