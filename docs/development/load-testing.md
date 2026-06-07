# Load Testing Guide

This guide covers performance testing with K6 for TradeWise AI.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Test Scripts](#test-scripts)
- [Running Tests](#running-tests)
- [Interpreting Results](#interpreting-results)
- [CI Integration](#ci-integration)
- [HPA Validation](#hpa-validation)

## Overview

### Test Types

| Type | Purpose | VUs | Duration |
|------|---------|-----|----------|
| **Smoke** | Verify system works | 10 | 1 min |
| **Load** | Normal traffic simulation | 100 | 20 min |
| **Stress** | Find breaking point | 500 | 20 min |
| **Spike** | Sudden traffic burst | 300 | 5 min |
| **HPA** | Autoscaling validation | Variable | 30 min |

### Thresholds

| Metric | Target |
|--------|--------|
| P95 Latency | < 300ms |
| P99 Latency | < 500ms |
| Error Rate | < 2% |
| Success Rate | > 98% |

## Installation

### Install K6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker run --rm -i grafana/k6 run - <script.js

# Verify
k6 version
```

## Test Scripts

### Location

```
loadtests/
├── smoke.k6.js        # Basic health check
├── load.k6.js         # Normal load simulation
├── stress.k6.js       # Stress testing
├── spike.k6.js        # Spike testing
└── hpa-validation.k6.js  # Kubernetes HPA testing
```

### Smoke Test

```javascript
// loadtests/smoke.k6.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

### Load Test

```javascript
// loadtests/load.k6.js
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '10m', target: 100 }, // Hold
    { duration: '3m', target: 50 },   // Ramp down
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};
```

### Stress Test

```javascript
// loadtests/stress.k6.js
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 200 },
    { duration: '5m', target: 300 },
    { duration: '5m', target: 400 },
    { duration: '5m', target: 500 },  // Breaking point
    { duration: '10m', target: 500 }, // Hold
    { duration: '5m', target: 0 },    // Recovery
  ],
};
```

### Spike Test

```javascript
// loadtests/spike.k6.js
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Baseline
    { duration: '10s', target: 300 },  // Spike!
    { duration: '2m', target: 300 },   // Hold spike
    { duration: '10s', target: 10 },   // Drop
    { duration: '1m', target: 10 },    // Recovery
  ],
};
```

## Running Tests

### Basic Usage

```bash
cd loadtests

# Run smoke test
k6 run smoke.k6.js

# With environment variable
k6 run -e BASE_URL=http://localhost:3000 smoke.k6.js

# Run load test
k6 run -e BASE_URL=http://localhost:3000 load.k6.js
```

### With Authentication

```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}' \
  | jq -r '.token')

# Run with token
k6 run -e BASE_URL=http://localhost:3000 -e AUTH_TOKEN=$TOKEN load.k6.js
```

### Output Formats

```bash
# JSON output
k6 run --out json=results.json smoke.k6.js

# InfluxDB (for Grafana)
k6 run --out influxdb=http://localhost:8086/k6 smoke.k6.js

# Multiple outputs
k6 run --out json=results.json --out influxdb=http://localhost:8086/k6 smoke.k6.js
```

### Docker

```bash
# Run in container
docker run --rm -i \
  -v $(pwd)/loadtests:/scripts \
  -e BASE_URL=http://host.docker.internal:3000 \
  grafana/k6 run /scripts/smoke.k6.js
```

## Interpreting Results

### Key Metrics

```
✓ http_req_duration..............: avg=145.2ms  min=12ms   med=98ms   max=2.1s   p(90)=312ms  p(95)=456ms
✓ http_req_failed................: 0.15%  ✓ 15        ✗ 9985
✓ http_req_waiting...............: avg=144.1ms  min=11ms   med=97ms   max=2.1s   p(90)=311ms  p(95)=454ms
  http_reqs......................: 10000  166.666667/s
  iteration_duration.............: avg=1.15s    min=1.01s  med=1.1s   max=3.2s   p(90)=1.32s  p(95)=1.47s
  iterations.....................: 10000  166.666667/s
  vus............................: 100    min=0       max=100
  vus_max........................: 100    min=100     max=100
```

### Understanding Metrics

| Metric | Description | Good Value |
|--------|-------------|------------|
| `http_req_duration` | Total request time | p95 < 500ms |
| `http_req_failed` | Failure rate | < 2% |
| `http_req_waiting` | Time waiting for response | Similar to duration |
| `http_reqs` | Total requests made | - |
| `iterations` | Script iterations | - |
| `vus` | Virtual users | - |

### Threshold Results

```
✓ http_req_duration: p(95) < 500ms  ← PASSED
✓ http_req_failed: rate < 0.02      ← PASSED
✗ http_req_duration: p(99) < 300ms  ← FAILED (actual: 456ms)
```

## CI Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/load-test.yml
name: Load Tests
on:
  workflow_dispatch:
    inputs:
      test_type:
        type: choice
        options: [smoke, load, stress, spike]
      environment:
        type: choice
        options: [staging, production]
```

### Running in CI

```bash
# Manual trigger
gh workflow run load-test.yml \
  --field test_type=load \
  --field environment=staging
```

### Threshold Enforcement

```javascript
// CI fails if thresholds not met
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500'],  // Will fail CI if exceeded
    http_req_failed: ['rate<0.02'],
  },
};
```

## HPA Validation

### Purpose

Validates Kubernetes Horizontal Pod Autoscaler:
1. Scales up when load increases
2. Scales down when load decreases
3. No request failures during scaling

### Test Phases

```
Phase 1: Baseline (30 VUs)      - Verify starting state (3 pods)
Phase 2: Increase (150 VUs)     - Trigger scale-up
Phase 3: Hold (200 VUs)         - Verify scaled state
Phase 4: Decrease (30 VUs)      - Trigger scale-down
Phase 5: Verify (10 VUs)        - Confirm scaled-down state
```

### Running HPA Test

```bash
# Ensure kubectl is configured
kubectl get pods -n tradewise

# Run HPA validation
k6 run -e BASE_URL=https://api.staging.tradewise.ai hpa-validation.k6.js

# Monitor HPA in another terminal
watch kubectl get hpa -n tradewise
```

### Expected Behavior

```
Time 0-2min:   3 pods (baseline)
Time 2-7min:   3→6 pods (scale up)
Time 7-12min:  6 pods (hold)
Time 12-22min: 6→3 pods (scale down)
Time 22+:      3 pods (stable)
```

### Monitoring During Test

```bash
# Watch pod count
watch kubectl get pods -n tradewise | grep api

# Watch HPA
watch kubectl get hpa api-hpa -n tradewise

# View HPA events
kubectl describe hpa api-hpa -n tradewise
```

## Custom Scenarios

### Realistic User Flow

```javascript
import { group } from 'k6';

export default function () {
  // Simulate real user journey
  group('Authentication', function () {
    http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: 'test@test.com',
      password: 'password',
    }));
  });

  group('View Dashboard', function () {
    http.get(`${BASE_URL}/api/trades/stats`);
    http.get(`${BASE_URL}/api/behavioral/summary`);
    http.get(`${BASE_URL}/api/coach/alerts`);
  });

  group('Create Trade', function () {
    http.post(`${BASE_URL}/api/trades`, JSON.stringify({
      symbol: 'RELIANCE',
      direction: 'long',
      entryPrice: 2450,
      quantity: 10,
    }));
  });
}
```

### Weighted Scenarios

```javascript
export const options = {
  scenarios: {
    readers: {
      executor: 'constant-vus',
      vus: 70,          // 70% read traffic
      duration: '10m',
      exec: 'readScenario',
    },
    writers: {
      executor: 'constant-vus',
      vus: 30,          // 30% write traffic
      duration: '10m',
      exec: 'writeScenario',
    },
  },
};

export function readScenario() {
  http.get(`${BASE_URL}/api/trades`);
}

export function writeScenario() {
  http.post(`${BASE_URL}/api/trades`, tradeData);
}
```

## Best Practices

### 1. Warm Up

Always include a warm-up phase:
```javascript
stages: [
  { duration: '1m', target: 10 },  // Warm up
  { duration: '5m', target: 100 }, // Test
]
```

### 2. Use Realistic Data

```javascript
const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC'];
const symbol = symbols[Math.floor(Math.random() * symbols.length)];
```

### 3. Add Think Time

```javascript
import { sleep } from 'k6';

export default function () {
  http.get(url);
  sleep(Math.random() * 2 + 1);  // 1-3 seconds
}
```

### 4. Test Incrementally

```bash
# Start with smoke
k6 run smoke.k6.js

# Then load
k6 run load.k6.js

# Finally stress
k6 run stress.k6.js
```
