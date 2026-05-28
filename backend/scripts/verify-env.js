#!/usr/bin/env node

/**
 * Environment & API Key Verification Script
 * 
 * Run with: node scripts/verify-env.js
 * 
 * Tests:
 * 1. Required environment variables
 * 2. MongoDB connection
 * 3. Google Gemini API
 * 4. HuggingFace FinBERT API
 * 5. Cohere API
 * 6. SMTP email (optional)
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}`),
  dim: (msg) => console.log(`${colors.dim}  ${msg}${colors.reset}`)
};

const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

async function checkEnvVars() {
  log.header('Checking Environment Variables');
  
  const required = [
    { key: 'PORT', default: '3000' },
    { key: 'NODE_ENV', default: 'development' },
    { key: 'MONGODB_URI', required: true },
    { key: 'JWT_SECRET', required: true },
  ];
  
  const aiKeys = [
    { key: 'GOOGLE_AI_API_KEY', required: true, name: 'Google Gemini' },
    { key: 'HUGGINGFACE_API_KEY', required: false, name: 'HuggingFace FinBERT' },
    { key: 'COHERE_API_KEY', required: false, name: 'Cohere' },
  ];
  
  const emailKeys = [
    { key: 'SMTP_HOST' },
    { key: 'SMTP_PORT' },
    { key: 'SMTP_USER' },
    { key: 'SMTP_PASS' },
  ];

  // Check required vars
  for (const v of required) {
    if (process.env[v.key]) {
      log.success(`${v.key} is set`);
      results.passed++;
    } else if (v.default) {
      log.warn(`${v.key} not set, using default: ${v.default}`);
      results.warnings++;
    } else {
      log.error(`${v.key} is MISSING (required)`);
      results.failed++;
    }
  }

  // Check AI keys
  log.header('Checking AI API Keys');
  for (const v of aiKeys) {
    if (process.env[v.key]) {
      const masked = process.env[v.key].substring(0, 8) + '...' + process.env[v.key].slice(-4);
      log.success(`${v.name}: ${masked}`);
      results.passed++;
    } else if (v.required) {
      log.error(`${v.name}: MISSING (required for core features)`);
      results.failed++;
    } else {
      log.warn(`${v.name}: Not set (optional - will use fallback)`);
      results.warnings++;
    }
  }

  // Check email config
  log.header('Checking Email Configuration');
  const hasEmail = emailKeys.every(v => process.env[v.key]);
  if (hasEmail) {
    log.success(`Email configured: ${process.env.SMTP_USER}`);
    results.passed++;
  } else {
    log.warn('Email not configured (briefings will show in dashboard only)');
    results.warnings++;
  }
}

async function testMongoDB() {
  log.header('Testing MongoDB Connection');
  
  if (!process.env.MONGODB_URI) {
    log.error('MONGODB_URI not set, skipping test');
    results.failed++;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    log.success(`Connected to MongoDB`);
    log.dim(`URI: ${process.env.MONGODB_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
    results.passed++;
    await mongoose.disconnect();
  } catch (err) {
    log.error(`MongoDB connection failed: ${err.message}`);
    results.failed++;
  }
}

async function testGeminiAPI() {
  log.header('Testing Google Gemini API');
  
  if (!process.env.GOOGLE_AI_API_KEY) {
    log.error('GOOGLE_AI_API_KEY not set, skipping test');
    results.failed++;
    return;
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: 'Say "API working" in exactly 2 words.' }]
        }]
      },
      { timeout: 10000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    log.success(`Gemini API working`);
    log.dim(`Response: "${text.trim().substring(0, 50)}..."`);
    results.passed++;
  } catch (err) {
    if (err.response?.status === 400) {
      log.error(`Gemini API error: Invalid API key`);
    } else if (err.response?.status === 403) {
      log.error(`Gemini API error: API key doesn't have access to this model`);
    } else if (err.response?.status === 429) {
      log.warn(`Gemini API rate limited (but key is valid)`);
      results.warnings++;
      return;
    } else {
      log.error(`Gemini API error: ${err.message}`);
    }
    results.failed++;
  }
}

async function testHuggingFaceAPI() {
  log.header('Testing HuggingFace FinBERT API');
  
  if (!process.env.HUGGINGFACE_API_KEY) {
    log.warn('HUGGINGFACE_API_KEY not set - will use keyword fallback for emotion detection');
    results.warnings++;
    return;
  }

  try {
    // Use the serverless inference API
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/ProsusAI/finbert',
      { inputs: 'The stock market is showing bullish momentum today.' },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // Increased timeout - model may need to warm up
      }
    );

    if (Array.isArray(response.data) && response.data[0]) {
      const sentiments = response.data[0];
      const topSentiment = Object.entries(sentiments).sort((a, b) => b[1] - a[1])[0];
      log.success(`FinBERT API working`);
      log.dim(`Test sentiment: "${topSentiment[0]}" (${(topSentiment[1] * 100).toFixed(1)}% confidence)`);
      results.passed++;
    } else if (response.data?.error?.includes('loading')) {
      log.warn('FinBERT model is loading (this is normal, try again in 20-30 seconds)');
      results.warnings++;
    } else {
      log.warn('FinBERT returned unexpected format');
      log.dim(`Response: ${JSON.stringify(response.data).substring(0, 100)}`);
      results.warnings++;
    }
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      log.error(`HuggingFace API error: Invalid or unauthorized token`);
      results.failed++;
    } else if (err.response?.status === 503 || err.response?.data?.error?.includes('loading')) {
      log.warn(`FinBERT model is loading (try again in 20-30 seconds)`);
      log.dim('This is normal - HuggingFace free tier loads models on-demand');
      results.warnings++;
    } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      log.warn(`Network/DNS issue - could not reach HuggingFace (check internet connection)`);
      results.warnings++;
    } else {
      log.error(`HuggingFace API error: ${err.message}`);
      log.dim('This might be a temporary issue. The key format looks correct.');
      results.failed++;
    }
  }
}

async function testCohereAPI() {
  log.header('Testing Cohere API');
  
  if (!process.env.COHERE_API_KEY) {
    log.warn('COHERE_API_KEY not set - term explanations will not work');
    results.warnings++;
    return;
  }

  try {
    // Use the v2 chat API (matches aiExplainService.js)
    const response = await axios.post(
      'https://api.cohere.com/v2/chat',
      {
        model: 'command-a-03-2025',
        messages: [
          {
            role: 'user',
            content: 'Define "stop loss" in trading in one sentence.'
          }
        ],
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const text = response.data?.message?.content?.[0]?.text || 
                 response.data?.text || 
                 JSON.stringify(response.data).substring(0, 100);
    log.success(`Cohere API working`);
    log.dim(`Response: "${text.trim().substring(0, 60)}..."`);
    results.passed++;
  } catch (err) {
    if (err.response?.status === 401) {
      log.error(`Cohere API error: Invalid API key`);
      results.failed++;
    } else if (err.response?.status === 404) {
      // Try the v1 API as fallback
      log.warn(`Cohere v2 API returned 404, trying v1...`);
      try {
        const v1Response = await axios.post(
          'https://api.cohere.ai/v1/generate',
          {
            model: 'command-a-03-2025',
            prompt: 'Define "stop loss" in trading in one sentence.',
            max_tokens: 50
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        const text = v1Response.data?.generations?.[0]?.text || '';
        log.success(`Cohere API working (v1 endpoint)`);
        log.dim(`Response: "${text.trim().substring(0, 60)}..."`);
        results.passed++;
      } catch (v1Err) {
        log.error(`Cohere API error: Both v1 and v2 failed`);
        log.dim(`v2 error: ${err.response?.status}, v1 error: ${v1Err.message}`);
        results.failed++;
      }
    } else {
      log.error(`Cohere API error: ${err.message}`);
      results.failed++;
    }
  }
}

async function testSMTP() {
  log.header('Testing SMTP Email');
  
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    log.warn('SMTP not fully configured - skipping email test');
    results.warnings++;
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.verify();
    log.success(`SMTP connection verified`);
    log.dim(`Ready to send from: ${process.env.SMTP_USER}`);
    results.passed++;
  } catch (err) {
    log.error(`SMTP error: ${err.message}`);
    log.dim('For Gmail: Enable 2FA and use App Password from https://myaccount.google.com/apppasswords');
    results.failed++;
  }
}

async function printSummary() {
  log.header('Summary');
  
  console.log(`
  ${colors.green}Passed:${colors.reset}   ${results.passed}
  ${colors.red}Failed:${colors.reset}   ${results.failed}
  ${colors.yellow}Warnings:${colors.reset} ${results.warnings}
  `);

  if (results.failed > 0) {
    console.log(`${colors.red}Some tests failed. Please fix the issues above.${colors.reset}\n`);
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log(`${colors.yellow}All critical tests passed, but some optional features are not configured.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}All tests passed! Your environment is fully configured.${colors.reset}\n`);
  }
}

async function main() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════╗
║       TradeWise AI - Environment Verification         ║
╚═══════════════════════════════════════════════════════╝${colors.reset}
  `);

  await checkEnvVars();
  await testMongoDB();
  await testGeminiAPI();
  await testHuggingFaceAPI();
  await testCohereAPI();
  await testSMTP();
  await printSummary();
}

main().catch(err => {
  console.error('Verification script error:', err);
  process.exit(1);
});
