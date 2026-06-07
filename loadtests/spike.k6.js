/**
 * K6 Spike Test
 * 
 * Test system behavior under sudden traffic spikes.
 * Run: k6 run spike.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const errorRate = new Rate('errors');
const spikeLatency = new Trend('spike_latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Baseline
    { duration: '10s', target: 300 },  // Sudden spike to 300!
    { duration: '2m', target: 300 },   // Hold spike
    { duration: '10s', target: 10 },   // Drop back down
    { duration: '1m', target: 10 },    // Recovery period
    { duration: '10s', target: 500 },  // Even bigger spike
    { duration: '2m', target: 500 },   // Hold
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% under 3s during spike
    http_req_failed: ['rate<0.15'],    // Allow up to 15% errors during spike
    errors: ['rate<0.15'],
  },
  tags: {
    testType: 'spike',
  },
};

const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

export default function () {
  // Focus on critical endpoints during spike
  const criticalEndpoints = [
    '/health',
    '/api/trades',
    '/api/coach/alerts',
  ];

  for (const endpoint of criticalEndpoints) {
    const reqHeaders = endpoint === '/health' ? {} : headers;
    const res = http.get(`${BASE_URL}${endpoint}`, { headers: reqHeaders });
    
    check(res, {
      [`${endpoint} responds`]: (r) => [200, 401, 429].includes(r.status),
    });

    spikeLatency.add(res.timings.duration);
    errorRate.add(![200, 401, 429].includes(res.status));
  }

  // Minimal sleep during spike test
  sleep(0.1);
}

export function handleSummary(data) {
  const p95Latency = data.metrics.spike_latency?.values?.['p(95)'] || 0;
  const errorPct = (data.metrics.errors?.values?.rate || 0) * 100;
  
  console.log(`\nSpike Test Summary:`);
  console.log(`  P95 Latency: ${p95Latency.toFixed(0)}ms`);
  console.log(`  Error Rate: ${errorPct.toFixed(2)}%`);
  
  return {
    'spike-test-results.json': JSON.stringify(data, null, 2),
  };
}
