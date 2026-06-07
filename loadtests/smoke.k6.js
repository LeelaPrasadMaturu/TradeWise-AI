/**
 * K6 Smoke Test
 * 
 * Basic health check to verify the system is operational.
 * Run: k6 run smoke.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests under 1.5s
    http_req_failed: ['rate<0.01'],     // Error rate under 1%
    checks: ['rate>0.99'],              // 99% of checks pass
  },
  tags: {
    testType: 'smoke',
  },
};

export default function () {
  // Health check endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check returns ok': (r) => r.json('status') === 'ok',
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'smoke-test-results.json': JSON.stringify(data, null, 2),
  };
}
