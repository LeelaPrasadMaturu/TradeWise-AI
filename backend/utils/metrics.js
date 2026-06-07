/**
 * Prometheus Metrics
 * 
 * Custom metrics for monitoring TradeWise AI:
 * - HTTP request metrics
 * - AI service metrics
 * - Business metrics (trades, patterns)
 * - Queue metrics
 * - Circuit breaker metrics
 */

const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'tradewise_',
  labels: { app: 'tradewise-api' },
});

// ============================================
// HTTP Metrics
// ============================================

const httpRequestsTotal = new client.Counter({
  name: 'tradewise_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'tradewise_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestsInFlight = new client.Gauge({
  name: 'tradewise_http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  registers: [register],
});

// ============================================
// AI Service Metrics
// ============================================

const aiApiDuration = new client.Histogram({
  name: 'tradewise_ai_api_duration_seconds',
  help: 'Duration of AI API calls in seconds',
  labelNames: ['provider', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

const aiApiTotal = new client.Counter({
  name: 'tradewise_ai_api_calls_total',
  help: 'Total number of AI API calls',
  labelNames: ['provider', 'operation', 'status'],
  registers: [register],
});

const aiApiTokens = new client.Counter({
  name: 'tradewise_ai_api_tokens_total',
  help: 'Total tokens used in AI API calls',
  labelNames: ['provider', 'type'], // type: input/output
  registers: [register],
});

// ============================================
// Circuit Breaker Metrics
// ============================================

const circuitBreakerState = new client.Gauge({
  name: 'tradewise_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 0.5=half-open)',
  labelNames: ['service'],
  registers: [register],
});

const circuitBreakerFailures = new client.Counter({
  name: 'tradewise_circuit_breaker_failures_total',
  help: 'Total circuit breaker failures',
  labelNames: ['service'],
  registers: [register],
});

// ============================================
// Business Metrics
// ============================================

const tradesProcessed = new client.Counter({
  name: 'tradewise_trades_processed_total',
  help: 'Total trades processed',
  labelNames: ['action', 'result'], // action: create/update/close, result: success/error/blocked
  registers: [register],
});

const patternsDetected = new client.Counter({
  name: 'tradewise_patterns_detected_total',
  help: 'Total behavioral patterns detected',
  labelNames: ['pattern_type', 'severity'],
  registers: [register],
});

const rulesEvaluated = new client.Counter({
  name: 'tradewise_rules_evaluated_total',
  help: 'Total trading rules evaluated',
  labelNames: ['rule_type', 'result'], // result: pass/warn/block
  registers: [register],
});

const activeUsers = new client.Gauge({
  name: 'tradewise_active_users',
  help: 'Number of active users in the last 24 hours',
  registers: [register],
});

const disciplineScore = new client.Histogram({
  name: 'tradewise_discipline_score',
  help: 'Distribution of discipline scores',
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [register],
});

// ============================================
// Queue Metrics
// ============================================

const queueDepth = new client.Gauge({
  name: 'tradewise_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue', 'state'], // state: waiting/active/delayed
  registers: [register],
});

const queueJobDuration = new client.Histogram({
  name: 'tradewise_queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
  registers: [register],
});

const queueJobsTotal = new client.Counter({
  name: 'tradewise_queue_jobs_total',
  help: 'Total queue jobs processed',
  labelNames: ['queue', 'job_type', 'status'], // status: completed/failed/stalled
  registers: [register],
});

// ============================================
// Cache Metrics
// ============================================

const cacheHits = new client.Counter({
  name: 'tradewise_cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache', 'namespace'],
  registers: [register],
});

const cacheMisses = new client.Counter({
  name: 'tradewise_cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache', 'namespace'],
  registers: [register],
});

// ============================================
// Middleware Functions
// ============================================

/**
 * Express middleware for HTTP metrics
 */
function httpMetricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  httpRequestsInFlight.inc();

  // Get route pattern (not the actual path with params)
  const getRoutePattern = () => {
    if (req.route) {
      return req.baseUrl + req.route.path;
    }
    return req.path;
  };

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = getRoutePattern();
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
    httpRequestsInFlight.dec();
  });

  next();
}

/**
 * Record AI API call metrics
 */
function recordAIApiCall(provider, operation, duration, status, tokens = {}) {
  aiApiDuration.observe({ provider, operation }, duration);
  aiApiTotal.inc({ provider, operation, status });
  
  if (tokens.input) {
    aiApiTokens.inc({ provider, type: 'input' }, tokens.input);
  }
  if (tokens.output) {
    aiApiTokens.inc({ provider, type: 'output' }, tokens.output);
  }
}

/**
 * Update circuit breaker state metric
 */
function updateCircuitBreakerState(service, state) {
  let value = 0;
  if (state === 'open') value = 1;
  else if (state === 'half-open') value = 0.5;
  circuitBreakerState.set({ service }, value);
}

/**
 * Record trade processed
 */
function recordTradeProcessed(action, result) {
  tradesProcessed.inc({ action, result });
}

/**
 * Record pattern detected
 */
function recordPatternDetected(patternType, severity) {
  patternsDetected.inc({ pattern_type: patternType, severity });
}

/**
 * Record rule evaluation
 */
function recordRuleEvaluation(ruleType, result) {
  rulesEvaluated.inc({ rule_type: ruleType, result });
}

/**
 * Update queue metrics
 */
function updateQueueMetrics(queue, waiting, active, delayed) {
  queueDepth.set({ queue, state: 'waiting' }, waiting);
  queueDepth.set({ queue, state: 'active' }, active);
  queueDepth.set({ queue, state: 'delayed' }, delayed);
}

/**
 * Record queue job completion
 */
function recordQueueJob(queue, jobType, status, duration) {
  queueJobsTotal.inc({ queue, job_type: jobType, status });
  if (duration !== undefined) {
    queueJobDuration.observe({ queue, job_type: jobType }, duration);
  }
}

/**
 * Record cache hit/miss
 */
function recordCacheAccess(cache, namespace, hit) {
  if (hit) {
    cacheHits.inc({ cache, namespace });
  } else {
    cacheMisses.inc({ cache, namespace });
  }
}

/**
 * Update active users count
 */
function updateActiveUsers(count) {
  activeUsers.set(count);
}

/**
 * Record discipline score
 */
function recordDisciplineScore(score) {
  disciplineScore.observe(score);
}

/**
 * Express endpoint handler for /metrics
 */
async function metricsEndpoint(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

/**
 * Get current metrics as JSON (for internal use)
 */
async function getMetricsJson() {
  return await register.getMetricsAsJSON();
}

module.exports = {
  // Registry
  register,
  
  // Middleware
  httpMetricsMiddleware,
  metricsEndpoint,
  
  // Recording functions
  recordAIApiCall,
  updateCircuitBreakerState,
  recordTradeProcessed,
  recordPatternDetected,
  recordRuleEvaluation,
  updateQueueMetrics,
  recordQueueJob,
  recordCacheAccess,
  updateActiveUsers,
  recordDisciplineScore,
  
  // Utility
  getMetricsJson,
  
  // Direct metric access (for custom use)
  metrics: {
    httpRequestsTotal,
    httpRequestDuration,
    httpRequestsInFlight,
    aiApiDuration,
    aiApiTotal,
    aiApiTokens,
    circuitBreakerState,
    circuitBreakerFailures,
    tradesProcessed,
    patternsDetected,
    rulesEvaluated,
    activeUsers,
    disciplineScore,
    queueDepth,
    queueJobDuration,
    queueJobsTotal,
    cacheHits,
    cacheMisses,
  },
};
