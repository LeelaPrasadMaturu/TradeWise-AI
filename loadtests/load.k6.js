/**
 * K6 Load Test
 * 
 * Normal load test to verify system performance under expected traffic.
 * Run: k6 run load.k6.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics
const errorRate = new Rate('errors');
const tradeDuration = new Trend('trade_api_duration');
const behavioralDuration = new Trend('behavioral_api_duration');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 VUs
    { duration: '5m', target: 100 },  // Ramp up to 100 VUs
    { duration: '10m', target: 100 }, // Stay at 100 VUs
    { duration: '3m', target: 50 },   // Ramp down to 50
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
    checks: ['rate>0.98'],
  },
  tags: {
    testType: 'load',
  },
};

// Simulated JWT token (replace with actual auth in real test)
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

export default function () {
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  group('Trades API', function () {
    // Get trades list
    const listRes = http.get(`${BASE_URL}/api/trades?page=1&limit=10`, { headers });
    check(listRes, {
      'trades list status 200 or 401': (r) => [200, 401].includes(r.status),
    });
    tradeDuration.add(listRes.timings.duration);
    errorRate.add(![200, 401].includes(listRes.status));

    // Get trade stats
    const statsRes = http.get(`${BASE_URL}/api/trades/stats`, { headers });
    check(statsRes, {
      'trades stats status 200 or 401': (r) => [200, 401].includes(r.status),
    });
    tradeDuration.add(statsRes.timings.duration);
  });

  group('Behavioral API', function () {
    const res = http.get(`${BASE_URL}/api/behavioral/summary`, { headers });
    check(res, {
      'behavioral summary status 200 or 401': (r) => [200, 401].includes(r.status),
    });
    behavioralDuration.add(res.timings.duration);
    errorRate.add(![200, 401].includes(res.status));
  });

  group('Discipline API', function () {
    const res = http.get(`${BASE_URL}/api/discipline/score`, { headers });
    check(res, {
      'discipline score status 200 or 401': (r) => [200, 401].includes(r.status),
    });
    errorRate.add(![200, 401].includes(res.status));
  });

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}
