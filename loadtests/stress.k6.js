/**
 * K6 Stress Test
 * 
 * Find the breaking point of the system.
 * Run: k6 run stress.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics
const errorRate = new Rate('errors');
const rateLimited = new Counter('rate_limited');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 VUs
    { duration: '3m', target: 200 },   // Ramp up to 200 VUs
    { duration: '5m', target: 300 },   // Ramp up to 300 VUs
    { duration: '5m', target: 400 },   // Ramp up to 400 VUs
    { duration: '5m', target: 500 },   // Ramp up to 500 VUs (stress point)
    { duration: '10m', target: 500 },  // Stay at 500 VUs
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'], // 99% under 2s (relaxed for stress)
    http_req_failed: ['rate<0.10'],    // Allow up to 10% errors
    errors: ['rate<0.10'],
  },
  tags: {
    testType: 'stress',
  },
};

const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

export default function () {
  // Mix of different endpoints
  const endpoints = [
    { url: '/health', method: 'GET', auth: false },
    { url: '/api/trades', method: 'GET', auth: true },
    { url: '/api/trades/stats', method: 'GET', auth: true },
    { url: '/api/behavioral/summary', method: 'GET', auth: true },
    { url: '/api/discipline/score', method: 'GET', auth: true },
    { url: '/api/coach/briefing', method: 'GET', auth: true },
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const reqHeaders = endpoint.auth ? headers : {};
  
  const res = http.get(`${BASE_URL}${endpoint.url}`, { headers: reqHeaders });
  
  const isSuccess = [200, 401, 403].includes(res.status);
  const isRateLimited = res.status === 429;
  
  check(res, {
    'status is acceptable': () => isSuccess || isRateLimited,
  });

  errorRate.add(!isSuccess && !isRateLimited);
  
  if (isRateLimited) {
    rateLimited.add(1);
  }

  sleep(Math.random() * 0.5); // Very short sleep for stress
}

export function handleSummary(data) {
  console.log('Rate limited requests:', data.metrics.rate_limited?.values?.count || 0);
  
  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
  };
}
