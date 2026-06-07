# Observability Guide

This guide covers monitoring, metrics, and tracing for TradeWise AI.

## Table of Contents

- [Overview](#overview)
- [Prometheus Metrics](#prometheus-metrics)
- [Grafana Dashboards](#grafana-dashboards)
- [Distributed Tracing](#distributed-tracing)
- [Logging](#logging)
- [Alerting](#alerting)

## Overview

### Observability Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ API Server  │  │   Worker    │  │  Frontend   │             │
│  │ /metrics    │  │ /metrics    │  │             │             │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘             │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROMETHEUS                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ - Scrapes /metrics every 15s                            │   │
│  │ - Stores time series data                               │   │
│  │ - Evaluates alert rules                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Grafana   │    │Alertmanager │    │   Jaeger    │
│ Dashboards  │    │   Alerts    │    │   Tracing   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Prometheus Metrics

### Accessing Metrics

```bash
# Local development
curl http://localhost:3000/metrics

# Docker Compose
curl http://localhost:9090/api/v1/targets  # Prometheus targets

# Kubernetes
kubectl port-forward svc/prometheus 9090:9090 -n tradewise
```

### Custom Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `tradewise_http_requests_total` | Counter | method, route, status_code | Total HTTP requests |
| `tradewise_http_request_duration_seconds` | Histogram | method, route, status_code | Request latency |
| `tradewise_ai_api_duration_seconds` | Histogram | provider, operation | AI API call duration |
| `tradewise_circuit_breaker_state` | Gauge | service | Circuit state (0=closed, 1=open) |
| `tradewise_queue_depth` | Gauge | queue, state | BullMQ queue size |
| `tradewise_trades_processed_total` | Counter | action, result | Trades processed |
| `tradewise_patterns_detected_total` | Counter | pattern_type, severity | Patterns detected |

### Using Metrics in Code

```javascript
const { 
  recordAIApiCall, 
  recordTradeProcessed,
  updateCircuitBreakerState,
} = require('./utils/metrics');

// Record AI API call
const start = Date.now();
const result = await callGemini(prompt);
const duration = (Date.now() - start) / 1000;
recordAIApiCall('gemini', 'post-trade-analysis', duration, 'success', {
  input: 100,
  output: 500,
});

// Record trade processed
recordTradeProcessed('create', 'success');

// Update circuit breaker state
updateCircuitBreakerState('gemini', 'open');
```

### Express Middleware

```javascript
const { httpMetricsMiddleware, metricsEndpoint } = require('./utils/metrics');

// Add to Express app
app.use(httpMetricsMiddleware);

// Expose /metrics endpoint
app.get('/metrics', metricsEndpoint);
```

### Key Queries

```promql
# Request rate
sum(rate(tradewise_http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, sum(rate(tradewise_http_request_duration_seconds_bucket[5m])) by (le))

# Error rate
sum(rate(tradewise_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(tradewise_http_requests_total[5m]))

# AI API latency by provider
histogram_quantile(0.99, sum(rate(tradewise_ai_api_duration_seconds_bucket[5m])) by (le, provider))

# Queue depth
tradewise_queue_depth{queue="ai-analysis", state="waiting"}
```

## Grafana Dashboards

### Accessing Grafana

```bash
# Docker Compose
open http://localhost:3002
# Default: admin/admin

# Kubernetes
kubectl port-forward svc/grafana 3002:3000 -n tradewise
```

### Pre-built Dashboards

Located in `observability/grafana/dashboards/`:

| Dashboard | Purpose |
|-----------|---------|
| `api-overview.json` | HTTP metrics, latency, errors |
| More coming... | AI services, queues, K8s |

### Import Dashboard

1. Open Grafana → Dashboards → Import
2. Upload JSON file or paste content
3. Select Prometheus data source
4. Click Import

### Key Panels

#### Request Rate
```promql
sum(rate(tradewise_http_requests_total[5m]))
```

#### P99 Latency
```promql
histogram_quantile(0.99, sum(rate(tradewise_http_request_duration_seconds_bucket[5m])) by (le)) * 1000
```

#### Error Rate
```promql
sum(rate(tradewise_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(tradewise_http_requests_total[5m]))
```

#### Circuit Breaker Status
```promql
tradewise_circuit_breaker_state
```

### Creating Custom Dashboard

1. Click + → Dashboard → Add new panel
2. Enter PromQL query
3. Configure visualization
4. Set thresholds and alerts
5. Save dashboard

## Distributed Tracing

### Jaeger Setup

```bash
# Docker Compose
open http://localhost:16686

# Kubernetes
kubectl port-forward svc/jaeger 16686:16686 -n tradewise
```

### Trace Context

Traces automatically propagate through:
- HTTP requests (via headers)
- Kafka messages (via message headers)
- BullMQ jobs (via job data)

### Viewing Traces

1. Open Jaeger UI
2. Select service: `tradewise-api`
3. Click "Find Traces"
4. Click on trace to see spans

### Trace Anatomy

```
Trade Creation Flow:
├─ POST /api/trades (145ms)
│  ├─ MongoDB insert (12ms)
│  ├─ Kafka publish (5ms)
│  └─ BullMQ enqueue (3ms)
│
└─ AI Worker (async)
   ├─ FinBERT API (890ms)
   ├─ MongoDB update (8ms)
   └─ Cache set (2ms)
```

### Adding Custom Spans

```javascript
const opentelemetry = require('@opentelemetry/api');

const tracer = opentelemetry.trace.getTracer('tradewise-api');

async function processWithTracing(data) {
  const span = tracer.startSpan('custom-operation');
  
  try {
    span.setAttribute('data.id', data.id);
    const result = await doWork(data);
    span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

## Logging

### Winston Configuration

```javascript
// backend/server.js uses Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `error` | Errors requiring attention |
| `warn` | Warning conditions |
| `info` | Normal operational messages |
| `debug` | Detailed debugging |

### Structured Logging

```javascript
logger.info('Trade created', {
  tradeId: trade._id,
  userId: req.user._id,
  symbol: trade.symbol,
  duration: Date.now() - startTime,
});
```

### Log Aggregation (Production)

For production, ship logs to:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Loki + Grafana
- CloudWatch Logs
- Datadog

## Alerting

### Prometheus Alert Rules

```yaml
# observability/prometheus/alerts.yml
groups:
  - name: tradewise
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(tradewise_http_requests_total{status_code=~"5.."}[5m])) /
          sum(rate(tradewise_http_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: Error rate is {{ $value | humanizePercentage }}

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, sum(rate(tradewise_http_request_duration_seconds_bucket[5m])) by (le)) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High P99 latency
          description: P99 latency is {{ $value }}s

      - alert: CircuitBreakerOpen
        expr: tradewise_circuit_breaker_state == 1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: Circuit breaker open for {{ $labels.service }}
```

### Alertmanager Configuration

```yaml
# observability/alertmanager/config.yml
route:
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#tradewise-alerts'
        send_resolved: true

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: <key>
```

### Grafana Alerts

1. Open dashboard panel
2. Click Alert → Create alert rule
3. Configure condition:
   - When: `avg()` of query `A` is above `0.05`
   - For: 2 minutes
4. Configure notifications
5. Save

## Health Checks

### API Health Endpoint

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-14T12:00:00.000Z",
  "services": {
    "mongodb": "connected",
    "redis": "connected",
    "kafka": "connected"
  }
}
```

### Extended Health Check

```javascript
// Add detailed health info
app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    mongodb: await checkMongoDB(),
    redis: await redisService.ping(),
    kafka: await kafkaClient.healthCheck(),
    circuits: circuitBreaker.getAllStatus(),
    queues: await queues.getAllQueueStats(),
  };
  
  const allHealthy = Object.values(health).every(v => 
    typeof v === 'boolean' ? v : v.healthy !== false
  );
  
  res.status(allHealthy ? 200 : 503).json(health);
});
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## SLIs and SLOs

### Service Level Indicators

| SLI | Measurement |
|-----|-------------|
| Availability | % of successful requests |
| Latency | P99 response time |
| Throughput | Requests per second |
| Error Rate | % of 5xx responses |

### Service Level Objectives

| Service | SLO |
|---------|-----|
| API Availability | 99.9% |
| P99 Latency | < 500ms |
| Error Rate | < 1% |
| AI Response Time | < 5s (P95) |

### Error Budget

```
Monthly Error Budget = 100% - SLO
For 99.9% availability: 0.1% = 43.2 minutes/month
```
