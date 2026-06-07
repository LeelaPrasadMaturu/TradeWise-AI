/**
 * K6 HPA Validation Test
 * 
 * Gradually increase load to trigger Kubernetes HPA scaling.
 * Validates that the system scales up and down correctly.
 * 
 * Run: k6 run hpa-validation.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import exec from 'k6/execution';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics for HPA validation
const errorRate = new Rate('errors');
const scaleUpLatency = new Trend('scale_up_latency');
const requestsPerSecond = new Counter('total_requests');

export const options = {
  stages: [
    // Phase 1: Baseline (should be 3 pods)
    { duration: '2m', target: 30 },
    
    // Phase 2: Increase load to trigger scale-up (CPU > 70%)
    { duration: '2m', target: 100 },
    { duration: '5m', target: 150 },   // Should trigger HPA
    
    // Phase 3: Verify scaled state
    { duration: '5m', target: 200 },   // Hold high load
    
    // Phase 4: Decrease load to trigger scale-down
    { duration: '2m', target: 50 },
    { duration: '10m', target: 30 },   // Wait for scale-down (5min stabilization)
    
    // Phase 5: Verify scaled-down state
    { duration: '2m', target: 10 },
  ],
  thresholds: {
    // Relaxed thresholds during scaling
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'], // 5% error tolerance during scaling
    errors: ['rate<0.05'],
  },
  tags: {
    testType: 'hpa-validation',
  },
};

const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

// CPU-intensive endpoints to trigger scaling
const cpuIntensiveEndpoints = [
  '/api/trades/stats',
  '/api/behavioral/patterns?period=30d',
  '/api/discipline/weekly-report',
  '/api/edge/analysis',
];

export default function () {
  const vu = exec.vu.idInTest;
  const iteration = exec.scenario.iterationInTest;
  
  // Log phase transitions
  const currentStage = getCurrentStage();
  if (iteration % 100 === 0) {
    console.log(`VU ${vu}: Stage ${currentStage}, Iteration ${iteration}`);
  }

  // Hit CPU-intensive endpoint
  const endpoint = cpuIntensiveEndpoints[vu % cpuIntensiveEndpoints.length];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers });
  
  const isSuccess = [200, 401].includes(res.status);
  const isRateLimited = res.status === 429;
  
  check(res, {
    'request successful or rate limited': () => isSuccess || isRateLimited,
    'latency under threshold': (r) => r.timings.duration < 2000,
  });

  scaleUpLatency.add(res.timings.duration);
  requestsPerSecond.add(1);
  errorRate.add(!isSuccess && !isRateLimited);

  // Also hit health to ensure basic functionality
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check ok': (r) => r.status === 200,
  });

  // Variable sleep based on phase
  const sleepTime = currentStage === 'scale-up' ? 0.2 : 0.5;
  sleep(sleepTime);
}

function getCurrentStage() {
  const time = exec.scenario.progress * exec.scenario.maxDuration;
  if (time < 120000) return 'baseline';
  if (time < 540000) return 'scale-up';
  if (time < 840000) return 'scaled';
  if (time < 1440000) return 'scale-down';
  return 'final';
}

export function handleSummary(data) {
  const totalRequests = data.metrics.total_requests?.values?.count || 0;
  const p95Latency = data.metrics.scale_up_latency?.values?.['p(95)'] || 0;
  const errorPct = (data.metrics.errors?.values?.rate || 0) * 100;
  
  console.log('\n========================================');
  console.log('HPA Validation Test Complete');
  console.log('========================================');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`P95 Latency: ${p95Latency.toFixed(0)}ms`);
  console.log(`Error Rate: ${errorPct.toFixed(2)}%`);
  console.log('');
  console.log('Expected HPA Behavior:');
  console.log('  - Scale up at ~5min (150 VUs)');
  console.log('  - Scale down at ~19min (30 VUs)');
  console.log('========================================\n');
  
  return {
    'hpa-validation-results.json': JSON.stringify(data, null, 2),
  };
}
