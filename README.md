# TradeWise AI - Intelligent Trading Assistant

TradeWise AI is a sophisticated trading assistant that combines AI-powered analysis with comprehensive trade tracking and emotional intelligence to help traders make better decisions.

## ✨ Features

### 🤖 AI-Powered Intelligence
- **Post-Trade Analysis**: Automatic AI review using Google Gemini when exit data is provided
- **Emotion Detection**: FinBERT-powered sentiment analysis for entry and exit reasons (positive/negative/neutral)
- **Weekly Insights**: AI-generated market insights delivered to your email every Sunday
- **Smart Explanations**: Cohere AI-powered explanations for trading terms and concepts
- **Pattern Recognition**: Automatic extraction of trading strategy tags from trade reasons

### 🎓 Personalized Learning System
- **Adaptive Quiz Generation**: Personalized quizzes based on YOUR actual trading mistakes and patterns
- **Smart Flashcards**: AI-generated flashcards from your trading history to reinforce lessons
- **Mistake Analysis**: System identifies recurring errors and emotional patterns
- **Progress Tracking**: See improvement over time as you learn from past trades

### 📊 Trading Management
- **Comprehensive Trade Tracking**: Log trades with entry, exit, and detailed review notes
- **Performance Analytics**: Win rate, profit/loss analysis, and statistics by strategy
- **Emotional Intelligence**: Track how emotions affect your trading decisions
- **Strategy Analysis**: Identify which strategies work best for you
- **CSV Import**: Import trades directly from Zerodha and other brokers

### 🧠 Behavioral Pattern Detection
- **Auto-Detected Trading Style**: System identifies if you're a scalper, intraday, swing, or positional trader
- **15+ Pattern Detectors**: Revenge trading, tilt streaks, overtrading, position sizing drift, time-of-day bias, and more
- **Style-Adaptive Thresholds**: Detection thresholds adjust based on YOUR trading style (10 min revenge window for scalpers vs 2 hours for intraday)
- **Cost Attribution**: See how much each behavioral pattern costs you in real money
- **Positive Pattern Recognition**: Get credit for consistent sizing, stop-loss discipline, and emotional neutrality
- **Real-Time Warnings**: Get warned about revenge trading or tilt before entering a trade

### 📋 Discipline Score & Pre-Trade Checklist
- **Custom Trading Rules**: Define your own rules (time windows, max trades per day, position limits, R:R requirements)
- **Pre-Trade Validation**: System checks trades against your rules before entry - can warn or block violations
- **11 Rule Types**: TIME_WINDOW, MAX_DAILY_TRADES, MAX_POSITION_SIZE, MAX_DAILY_LOSS, MIN_RISK_REWARD, and more
- **Custom Checklist Items**: Add your own pre-trade questions ("Is this in my playbook?")
- **Emotional State Tracking**: Track and optionally restrict trading based on emotional state
- **Discipline Score**: Weekly score (0-100) tracking your rule compliance
- **Win Rate Correlation**: See how following rules correlates with your win rate
- **Rule Templates**: Pre-built rule sets for Conservative Intraday, Aggressive Scalper, and Swing Trading styles

### 🎯 Real-Time Trading Coach
- **Proactive Alerts**: Get warned during trading when patterns emerge
  - "You've taken 4 trades today. Your win rate drops after trade #3"
  - "Last 2 trades were losses. Consider taking a break"
  - "You're trading outside your best hours (10-11 AM)"
- **Pre-Market Briefing**: Daily email at 8:30 AM IST with:
  - Yesterday's performance summary
  - Rules violated yesterday
  - Your best trading hours today
  - Day-of-week warning ("You tend to struggle on Mondays")
  - AI-generated focus areas for the day
- **5 Alert Types**: TRADE_COUNT, LOSS_STREAK, BAD_HOUR, REVENGE_RISK, TILT_WARNING

### 🔒 Security & Quality
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Comprehensive Testing**: 85+ tests covering unit, integration, and E2E scenarios
- **CI/CD Pipeline**: Automated testing with GitHub Actions
- **80%+ Code Coverage**: Ensuring reliability and quality


## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **AI Services**:
  - **Cohere AI**: Trading term explanations and educational content
  - **Hugging Face FinBERT**: Emotion detection and sentiment analysis
  - **Google Gemini 2.0**: Post-trade analysis, weekly insights, quiz & flashcard generation
- **Authentication**: JWT (JSON Web Tokens)
- **Testing**: Jest with Supertest (85+ tests, 80%+ coverage)
- **CI/CD**: GitHub Actions for automated testing
- **Email**: Nodemailer for weekly insights delivery
- **Scheduling**: Node-cron for automated tasks

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- API keys for:
  - Cohere AI
  - Hugging Face
  - Google Gemini

## Installation

1. Clone the repository:
```bash
git clone <repository_url>
cd tradewise-ai
```

2. Install dependencies:
```bash
npm install
```

3. Setup MongoDB:
```bash
# Ensure MongoDB is running
mongod
```

4. Create a `.env` file in the root directory with the following variables:
```env
# Server Configuration
PORT=3000
MONGODB_URI=your_mongodb_connection_string

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# AI Service API Keys
COHERE_API_KEY=your_cohere_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
GOOGLE_AI_API_KEY=your_google_gemini_api_key
```

## Getting API Keys

### 1. Cohere AI API Key
1. Visit [Cohere AI](https://cohere.ai/)
2. Sign up for an account
3. Navigate to the API Keys section
4. Create a new API key
5. Copy the key to your `.env` file

### 2. Hugging Face API Key
1. Visit [Hugging Face](https://huggingface.co/)
2. Create an account
3. Go to Settings > Access Tokens
4. Create a new token with read access
5. Copy the token to your `.env` file

### 3. Google Gemini API Key
1. Visit the Google AI Studio website
2. Sign in and create a project
3. Generate an API key for Generative Language
4. Copy the key to your `.env` as `GOOGLE_AI_API_KEY`

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # End-to-end tests only

# Watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

See [tests/README.md](./tests/README.md) for detailed testing documentation.

## 🧪 Testing

TradeWise AI includes a comprehensive test suite with **85+ tests**:

### Test Coverage
- **Unit Tests (30 tests)**: Services in isolation (emotion detection, quiz generation, insights)
- **Integration Tests (33 tests)**: API endpoints with database interactions
- **E2E Tests (22 tests)**: Complete user workflows from registration to learning

### Test Features
- ✅ All core functionality tested
- ✅ AI service integration tests
- ✅ Emotion detection validation
- ✅ Quiz and flashcard generation
- ✅ Trading pattern analysis
- ✅ Error handling and edge cases
- ✅ 80%+ code coverage

### CI/CD Pipeline
Automated testing runs on every push and pull request:
- Tests on Node.js 18.x and 20.x
- MongoDB integration testing
- Coverage reporting
- Artifact storage for debugging

View workflow: `.github/workflows/test.yml`

## API Documentation

### Authentication Routes

#### POST /api/auth/register
Register a new user.
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

#### POST /api/auth/login
Login to get JWT token.
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Price Routes

#### GET /api/prices
Get prices for all supported assets.
```json
Response:
{
  "success": true,
  "data": {
    "crypto": [
      {
        "symbol": "bitcoin",
        "assetType": "crypto",
        "price": 50000.00,
        "timestamp": "2024-03-14T12:00:00.000Z"
      },
      {
        "symbol": "ethereum",
        "assetType": "crypto",
        "price": 3000.00,
        "timestamp": "2024-03-14T12:00:00.000Z"
      }
    ],
    "stocks": [],
    "forex": [],
    "commodities": [],
    "timestamp": "2024-03-14T12:00:00.000Z"
  }
}
```

#### GET /api/prices/:assetType
Get prices for a specific asset type.
Query Parameters:
- `symbols`: Comma-separated list of symbols (optional)

Example for crypto:
```http
GET /api/prices/crypto?symbols=bitcoin,ethereum
Response:
{
  "success": true,
  "data": [
    {
      "symbol": "bitcoin",
      "assetType": "crypto",
      "price": 50000.00,
      "timestamp": "2024-03-14T12:00:00.000Z"
    },
    {
      "symbol": "ethereum",
      "assetType": "crypto",
      "price": 3000.00,
      "timestamp": "2024-03-14T12:00:00.000Z"
    }
  ]
}
```

Supported Asset Types:
- `crypto`: Cryptocurrency prices (implemented)
- `stocks`: Stock prices (coming soon)
- `forex`: Forex prices (coming soon)
- `commodities`: Commodity prices (coming soon)

Note: All price routes require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Trade Routes

#### POST /api/trades
Create a new trade entry.
```json
{
  "symbol": "AAPL",
  "entryPrice": 150.25,
  "quantity": 10,
  "direction": "long",
  "stopLoss": 145.00,
  "takeProfit": 160.00,
  "reason": "Strong breakout with high volume",
  "tags": ["breakout", "volume"],
  "preTradeEmotion": "calm",
  "checklistResponses": [
    { "itemId": "abc123", "response": true },
    { "question": "Is this in my playbook?", "response": true }
  ]
}
```
The system will automatically:
- **Run pre-trade validation** against your trading rules (if enabled)
- **Block the trade** if it violates any blocking rules
- Analyze the trade reason for emotional content using FinBERT
- Extract relevant trading strategy tags
- Combine them with user-provided tags
- **Calculate discipline score** and track rule compliance

If trade is blocked (HTTP 403):
```json
{
  "blocked": true,
  "message": "Trade blocked by your trading rules",
  "violations": ["Daily loss limit reached: ₹5,000 lost today"],
  "warnings": ["This is your 4th trade today"],
  "score": 45
}
```

If trade is allowed with warnings:
```json
{
  "...trade data...",
  "disciplineScore": 85,
  "rulesViolated": ["MAX_DAILY_TRADES"],
  "ruleValidation": {
    "score": 85,
    "warnings": ["This is your 4th trade today (limit: 3)"],
    "summary": { "totalRules": 5, "passed": 4, "warnings": 1, "blocks": 0 }
  }
}
```

Use `skipValidation: true` to bypass rule checking for imported or historical trades.

Emotion labels stored under `emotionAnalysis.detected` use FinBERT outcomes: `positive`, `negative`, `neutral`.

#### GET /api/trades
Get all trades with pagination and sorting.
Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sort`: Sort field (default: -tradeDate)

#### GET /api/trades/stats
Get trading statistics including:
- Overall performance metrics
- Win rate by tag
- Profit/loss analysis
- Trade frequency analysis

#### GET /api/trades/:id
Get a specific trade by ID.

#### PATCH /api/trades/:id
Update a trade. Allowed fields:
- symbol
- entryPrice
- exitPrice
- quantity
- direction
- stopLoss
- takeProfit
- reason
- tags
- result
- profitLoss
- notes
- chartScreenshot
- exitReason
- postTradeReview (object)

When you update `reason`, the system re-runs emotion analysis and enriches `tags` based on detected keywords. When you update `exitReason`, the system saves `exitEmotionAnalysis` (FinBERT labels) and, if any exit-related fields change (`exitPrice`, `exitReason`, `postTradeReview`, `result`, `profitLoss`), it generates a fresh `postTradeAnalysis` using Google Gemini and embeds it under `postTradeAnalysis`.

#### DELETE /api/trades/:id
Delete a trade.

### AI Explanation Routes

#### POST /api/explain
Get AI explanation of any text with optional context.
```json
{
  "text": "What is a breakout?",
  "context": "trading"
}
```

#### GET /api/explain/term
Get AI explanation of a financial term.
Query Parameters:
- `term`: The term to explain
- `level`: Expertise level (beginner/intermediate/expert, default: 'expert')

#### GET /api/explain/quiz
Generate a personalized quiz based on your trading history and mistakes.
Query Parameters:
- `count`: Number of questions (default: 5)
- `difficulty`: Quiz difficulty (easy/medium/hard, default: 'medium')

Response includes:
- Personalized questions based on YOUR actual trading mistakes
- References to your specific trades and patterns
- Explanations tied to your trading history
- Focus areas identified from your weaknesses

Example:
```json
{
  "quiz": [
    {
      "id": 1,
      "question": "Based on your trading history, you've lost money 70% of the time when entering trades with 'fear' emotion. In which scenario should you AVOID taking a trade?",
      "options": [
        "A) Strong breakout with high volume, feeling confident",
        "B) Price dropping fast, afraid to miss the bottom, feeling anxious",
        "C) Clear support level hold, neutral emotion",
        "D) Bullish divergence on RSI, feeling prepared"
      ],
      "correctAnswer": "B",
      "explanation": "Your data shows that trades entered with fear/anxiety resulted in 70% losses...",
      "category": "emotional-awareness",
      "personalizedInsight": "In your worst trade on AAPL, you entered with fear and lost $450."
    }
  ],
  "basedOnTrades": 25,
  "userContext": {
    "winRate": "48.00",
    "primaryWeakness": "negative"
  }
}
```

#### GET /api/explain/flashcards
Generate personalized flashcards from your trading mistakes and lessons.
Query Parameters:
- `count`: Number of flashcards (default: 10)
- `category`: Category filter (emotions/mistakes/strategies/risk-management/all, default: 'all')

Response includes:
- Flashcards based on YOUR actual mistakes
- Real examples from your trading history
- Actionable reminders for improvement
- Priority levels based on frequency of mistakes

Example:
```json
{
  "flashcards": [
    {
      "id": 1,
      "front": "What emotion led to 70% of your losing trades?",
      "back": "Fear/Anxiety. Your data shows that when you entered trades feeling fearful or anxious (often FOMO), you lost 70% of the time.",
      "category": "emotional-awareness",
      "priority": "high",
      "realExample": "Your worst trade: AAPL on Jan 15 - entered with fear, lost $450",
      "actionableReminder": "Wait 5 minutes when feeling anxious. If fear persists, skip the trade."
    }
  ],
  "basedOnTrades": 25,
  "userContext": {
    "winRate": "48.00",
    "topMistake": "Moved stop-loss further away"
  }
}
```

### Insights Routes

#### GET /api/insights/weekly
Get weekly trading insights.
Query Parameters:
- `startDate`: Start date for insights period
- `endDate`: End date for insights period

### Alert Routes

#### POST /api/alerts
Create a new price alert.
```json
{
  "symbol": "AAPL",
  "assetType": "stock",
  "triggerType": "price_above",
  "triggerValue": 150.00,
  "notificationChannels": {
    "email": true,
    "telegram": false,
    "sms": false
  },
  "description": "Alert when AAPL goes above $150"
}
```

Example for cryptocurrency:
```json
{
  "symbol": "BTC",
  "assetType": "crypto",
  "triggerType": "price_above",
  "triggerValue": 30000,
  "notificationChannels": {
    "email": true,
    "telegram": false,
    "sms": false
  },
  "description": "BTC price alert above 30,000 USDT"
}
```

#### GET /api/alerts
Get all alerts for the authenticated user.

#### PUT /api/alerts/:id
Update an existing alert.

#### DELETE /api/alerts/:id
Delete an alert.

#### GET /api/alerts/stats
Get alert statistics including:
- #### POST /api/alerts/monitor/start
Start background price monitoring for active alerts.

- #### POST /api/alerts/monitor/stop
Stop background price monitoring.

- Total active alerts
- Triggered alerts count
- Cancelled alerts count

### Import Routes (CSV Trade Import)

#### GET /api/import/supported-brokers
Get list of supported broker formats and their expected CSV columns.

#### GET /api/import/sample-csv
Download a sample CSV template.
Query Parameters:
- `broker`: "zerodha" or "generic" (default: "zerodha")

#### POST /api/import/csv/validate
Validate CSV before import (dry run). Returns preview of trades that would be imported.
```json
{
  "csv": "trade_date,exchange,symbol,trade_type,quantity,price\n2024-03-15,NSE,RELIANCE,buy,10,2450.50",
  "broker": "auto"
}
```

#### POST /api/import/csv
Import trades from broker CSV export.
```json
{
  "csv": "<CSV content as string>",
  "broker": "auto",
  "includeOpen": true,
  "skipDuplicates": true
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully imported 5 trades",
  "broker": "zerodha",
  "summary": {
    "totalExecutions": 12,
    "parsedExecutions": 12,
    "completedTrades": 5,
    "openPositions": 2,
    "imported": 7,
    "skipped": 0
  },
  "importedTrades": [...]
}
```

**Supported Brokers:**
- **Zerodha**: Direct import from Kite/Console tradebook CSV
- **Generic**: Any CSV with columns: date, symbol, type (buy/sell), quantity, price

See [samples/README.md](./samples/README.md) for detailed CSV format documentation.

### Behavioral Analysis Routes

#### GET /api/behavioral/patterns
Get all detected behavioral patterns for the authenticated user.
Query Parameters:
- `period`: Analysis period (7d, 14d, 30d, 60d, 90d) - default: 30d
- `type`: Filter by pattern type
- `severity`: Filter by severity (high, medium, low)

Response includes behavioral score, detected patterns, and recommendations.

#### GET /api/behavioral/summary
Get a quick behavioral health summary.
```json
{
  "behavioralScore": 72,
  "tradingStyle": "INTRADAY",
  "topIssues": [
    {
      "type": "REVENGE_TRADING",
      "severity": "high",
      "insight": "4 revenge trades detected",
      "costEstimate": -2450
    }
  ],
  "positivePatterns": ["CONSISTENT_SIZING", "STOP_LOSS_DISCIPLINE"],
  "recommendations": [...]
}
```

#### GET /api/behavioral/pattern/:type
Deep dive into a specific pattern type (e.g., REVENGE_TRADING, TILT_STREAK).

#### GET /api/behavioral/baseline
Get user's calculated trading baseline metrics including:
- Trading style (SCALPER, INTRADAY, SWING, POSITIONAL)
- Average position size, daily trade count, hold duration
- Best/worst performing hours and days
- Symbol-level performance

#### POST /api/behavioral/baseline/recalculate
Force recalculate user baseline from trade history.

#### GET /api/behavioral/style
Get detected trading style with style-specific thresholds.

#### GET /api/behavioral/supported-patterns
List all 15 detectable patterns with descriptions.

**Detected Patterns:**
1. REVENGE_TRADING - Quick re-entry after loss with larger position
2. TILT_STREAK - Multiple consecutive losses
3. OVERTRADING - Excessive daily trade frequency
4. RAPID_FIRE - Multiple trades in short window
5. POSITION_SIZE_DRIFT_UP - Overconfidence sizing after wins
6. POSITION_SIZE_DRIFT_DOWN - Fear-based undersizing after losses
7. POSITION_SIZE_CHAOS - Inconsistent position sizing
8. TIME_OF_DAY_BIAS - Poor performance at certain hours
9. DAY_OF_WEEK_BIAS - Poor performance on certain days
10. SYMBOL_LOSS_CLUSTERING - Repeated losses on same symbol
11. FIRST_TRADE_SYNDROME - First daily trade underperforms
12. LOSS_AVERSION - Holding losers longer than winners
13. NEGATIVE_EMOTION_TRADING - Trading with detected negative sentiment
14. FOMO_ENTRY - Fear of missing out detected in trade reason
15. STOP_LOSS_VIOLATION - Not respecting stated stop losses

### Trading Rules Routes

#### GET /api/rules
Get all trading rules for the authenticated user.

#### POST /api/rules
Create a new trading rule.
```json
{
  "name": "Morning Session Only",
  "description": "Only trade during the most liquid morning hours",
  "ruleType": "TIME_WINDOW",
  "action": "warn",
  "params": {
    "startHour": 9,
    "startMinute": 30,
    "endHour": 11,
    "endMinute": 30
  }
}
```

**Supported Rule Types:**
| Rule Type | Description | Params |
|-----------|-------------|--------|
| TIME_WINDOW | Only trade during specific hours | startHour, startMinute, endHour, endMinute |
| MAX_DAILY_TRADES | Limit trades per day | maxTrades |
| MAX_POSITION_SIZE | Cap position size | maxSizeType (percentage/absolute), maxSizeValue |
| MAX_DAILY_LOSS | Stop after daily loss limit | maxLossType, maxLossValue |
| MIN_RISK_REWARD | Minimum R:R ratio | minRiskReward |
| REQUIRED_STOP_LOSS | Must have stop loss | (none) |
| REQUIRED_TAKE_PROFIT | Must have take profit | (none) |
| ALLOWED_SYMBOLS | Whitelist symbols | symbols[] |
| BLOCKED_SYMBOLS | Blacklist symbols | symbols[] |
| MAX_CONSECUTIVE_LOSSES | Stop after loss streak | maxConsecutiveLosses |
| COOLING_OFF_AFTER_LOSS | Wait after loss | coolingMinutes |

#### PATCH /api/rules/:id
Update a trading rule.

#### POST /api/rules/:id/toggle
Enable/disable a rule.

#### DELETE /api/rules/:id
Delete a trading rule.

#### GET /api/rules/templates
Get pre-built rule templates (CONSERVATIVE_INTRADAY, AGGRESSIVE_SCALPER, SWING_TRADER).

#### POST /api/rules/templates/:templateName/apply
Apply a rule template to your account.

#### POST /api/rules/validate
Pre-trade validation - check if a trade would pass all rules before entry.
```json
{
  "symbol": "RELIANCE",
  "entryPrice": 2450.50,
  "quantity": 10,
  "direction": "long",
  "stopLoss": 2400,
  "takeProfit": 2550,
  "reason": "Strong breakout",
  "preTradeEmotion": "calm",
  "checklistResponses": [
    { "itemId": "abc123", "response": true }
  ]
}
```

Response:
```json
{
  "allowed": true,
  "score": 85,
  "summary": {
    "totalRules": 5,
    "passed": 4,
    "warnings": 1,
    "blocks": 0
  },
  "warnings": ["This is your 4th trade today (limit: 3)"],
  "blockReasons": []
}
```

### Trading Config Routes

#### GET /api/rules/config/settings
Get user's trading configuration (capital, checklist settings, emotional preferences).

#### PATCH /api/rules/config/settings
Update trading configuration.
```json
{
  "checklistEnabled": true,
  "blockOnFailure": true,
  "requireEmotionalCheck": true,
  "allowedEmotions": ["calm", "neutral", "confident"],
  "blockedEmotions": ["revenge", "fomo", "frustrated"]
}
```

#### PATCH /api/rules/config/capital
Update trading capital (for percentage-based rules).
```json
{
  "capital": 500000,
  "note": "Monthly capital update"
}
```

#### POST /api/rules/config/checklist/items
Add a custom checklist item.
```json
{
  "question": "Is this setup in my trading playbook?",
  "required": true,
  "action": "warn"
}
```

#### DELETE /api/rules/config/checklist/items/:itemId
Remove a custom checklist item.

### Discipline Score Routes

#### GET /api/discipline/score
Get current discipline score (default: last 7 days).

#### GET /api/discipline/score/:period
Get discipline score for specific period (7d, 30d, 90d).

#### GET /api/discipline/weekly-report
Get comprehensive weekly discipline report.
```json
{
  "period": { "start": "2024-03-11", "end": "2024-03-17" },
  "overallScore": 72,
  "totalTrades": 15,
  "compliantTrades": 11,
  "byRule": [
    {
      "ruleName": "Max 3 Trades/Day",
      "complianceRate": 60,
      "violations": 2
    }
  ],
  "correlation": {
    "winRateWhenCompliant": 58.2,
    "winRateWhenViolating": 33.3,
    "insight": "You win 25% more when following your rules"
  },
  "recommendations": [...]
}
```

#### GET /api/discipline/correlation
Get win rate correlation with compliance.

#### GET /api/discipline/violations
Get recent rule violations.

#### GET /api/discipline/suggestions
Get AI-suggested rules based on your trading patterns.

#### GET /api/discipline/summary
Quick discipline summary for dashboard.

#### GET /api/discipline/blocked
Get blocked trade attempts.

### Trading Coach Routes

#### GET /api/coach/briefing
Get today's pre-market briefing on-demand.
```json
{
  "greeting": "Good morning",
  "yesterdaySummary": {
    "tradeCount": 5,
    "wins": 3,
    "losses": 2,
    "winRate": 60,
    "pnl": 1250.50,
    "message": "3W/2L (60% win rate)"
  },
  "rulesViolated": {
    "count": 2,
    "rules": ["Max 3 Trades/Day", "Morning Session Only"]
  },
  "dayOfWeekWarning": {
    "dayName": "Monday",
    "winRate": 42,
    "warning": "You tend to struggle on Mondays (42% win rate vs 55% average)"
  },
  "bestHours": {
    "hours": [{ "hour": 10, "winRate": 68 }, { "hour": 11, "winRate": 62 }],
    "message": "Your best trading hours: 10:00 (68%), 11:00 (62%)"
  },
  "focusAreas": [
    "Follow your max 3 trades rule today",
    "Wait for A+ setups only"
  ]
}
```

#### GET /api/coach/alerts
Get current active coaching alerts.
```json
{
  "alerts": [
    {
      "type": "TRADE_COUNT",
      "severity": "warning",
      "message": "You've taken 4 trades today. Your win rate drops after trade #3 (45% vs 58% normal)"
    },
    {
      "type": "LOSS_STREAK",
      "severity": "high",
      "message": "Last 2 trades were losses. Consider taking a break."
    }
  ]
}
```

#### POST /api/coach/briefing/send
Manually trigger briefing email (for testing).

#### GET /api/coach/preferences
Get user's coaching preferences.

#### PATCH /api/coach/preferences
Update coaching preferences.
```json
{
  "enableRealTimeAlerts": true,
  "enablePreMarketBriefing": true,
  "briefingTime": "08:30",
  "timezone": "Asia/Kolkata"
}
```

#### GET /api/coach/summary/yesterday
Get yesterday's trading summary.

#### GET /api/coach/day-warning
Get day-of-week performance warning.

## Work in Progress Features

### Enhanced Alert System
- [ ] SMS Notifications
  - Integration with SMS gateway providers
  - Customizable SMS templates
  - Rate limiting and delivery status tracking

- [ ] Telegram Bot Integration
  - Real-time price alerts
  - Interactive alert management
  - Custom commands for market data

### Trading Analytics & Automation
- [ ] Comprehensive Trade Performance Dashboard
  - Detailed metrics and analytics for all trades
  - Performance tracking across different timeframes
  - Profit/loss visualization and analysis

- [ ] Custom Strategy Analysis

- [x] **CSV Trade Import** - Import trades directly from broker exports
  - Zerodha Tradebook CSV support
  - Generic CSV format support
  - FIFO trade matching (buy/sell pairing)
  - Duplicate detection
  - See [samples/](./samples/) for CSV templates

- [ ] Demat Account Integration (Future)
  - Direct API connection with your trading account
  - Real-time portfolio synchronization

### Extended Market Coverage
- [ ] Indian Markets Integration
  - NSE (National Stock Exchange)
  - BSE (Bombay Stock Exchange)
  - F&O segment


- [ ] Global Markets Support
  - European markets (LSE, Euronext)
  - Asian markets (HKEX, SGX)
  - Australian markets (ASX)
  - Note: Currently limited by free API availability

### Educational Features
- [x] **Personalized Quiz System** - AI-generated quizzes based on your actual trading mistakes
- [x] **Smart Flashcard Generation** - Flashcards created from your trading history and lessons learned
- [ ] Interactive Quiz UI with progress tracking
- [ ] Spaced repetition algorithm for flashcards
- [ ] Gamification with achievements and streaks

### Discipline & Rule System
- [x] **Trading Rules Engine** - Define and enforce your personal trading rules
- [x] **Pre-Trade Checklist** - Custom checklist items with warn/block actions
- [x] **Discipline Score** - Track rule compliance with weekly scores
- [x] **Win Rate Correlation** - See impact of rule-following on performance
- [x] **Rule Templates** - Pre-built rule sets for different trading styles
- [x] **Trade Blocking** - Optionally block trades that violate rules
- [x] **Emotional State Tracking** - Restrict trading based on emotional state

---

## 🗺️ Full Roadmap

For a comprehensive view of planned features and future development, see **[ROADMAP.md](./ROADMAP.md)**.

Key upcoming priorities:
- **Phase 1**: Web Dashboard & Mobile App
- **Phase 2**: Zerodha/Broker API Integration (auto-import trades)
- **Phase 3**: Advanced Analytics (P&L calendar, performance attribution)
- **Phase 4**: AI Trading Coach Chatbot
- **Phase 5**: Social Features (accountability partners)

---

## Additional Insights (from trading logs)

- Profit percentage (per trade): Derived from stored fields when an exit exists.
  - Formula: `profitPercentage = (profitLoss / (entryPrice * quantity)) * 100`
  - Notes:
    - Positive for profitable trades, negative for losing trades
    - Can be summarized across a set of trades (e.g., average profit percentage) in reports/insights
    - Since `profitLoss`, `entryPrice`, and `quantity` are already stored, this can be computed client- or server-side without schema changes

## Error Handling

The API uses standard HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Security

- All routes except registration and login require JWT authentication
- Passwords are hashed using bcrypt
- API keys are stored securely in environment variables
- Input validation and sanitization on all routes

## 📁 Project Structure

```
TradeWise-AI/
├── backend/
│   ├── config/          # Configuration files
│   ├── middlewares/     # Express middlewares (auth, validation)
│   ├── models/          # MongoDB models
│   │   ├── User.js
│   │   ├── Trade.js                  # Trade model with behavioral & discipline fields
│   │   ├── TradeAlert.js
│   │   ├── UserBaseline.js           # Trading style & baseline metrics
│   │   ├── TradingRule.js            # User-defined trading rules
│   │   ├── UserTradingConfig.js      # Trading config & checklist settings
│   │   └── TradeRuleCheck.js         # Rule validation history
│   ├── routes/          # API routes
│   │   ├── importRoutes.js           # CSV import endpoints
│   │   ├── behavioralRoutes.js       # Behavioral pattern analysis
│   │   ├── rulesRoutes.js            # Trading rules CRUD & validation
│   │   ├── disciplineRoutes.js       # Discipline score & reports
│   │   └── coachRoutes.js            # Real-time coaching & briefings
│   ├── services/        # Business logic
│   │   ├── behavioralPatternService.js # 15 pattern detection algorithms
│   │   ├── csvImportService.js       # Broker CSV parsing & trade matching
│   │   ├── emotionDetectService.js   # FinBERT emotion detection
│   │   ├── quizFlashcardService.js   # Personalized learning
│   │   ├── insightsService.js        # Weekly insights + behavioral
│   │   ├── postTradeAnalysisService.js # Post-trade AI + pattern warnings
│   │   ├── ruleValidationService.js  # Pre-trade rule validation
│   │   ├── disciplineScoreService.js # Discipline scoring & analytics
│   │   ├── tradingCoachService.js    # Real-time alerts & pre-market briefing
│   │   ├── schedulerService.js       # Cron jobs for daily briefings
│   │   └── aiExplainService.js       # Cohere explanations
│   └── server.js        # Express app entry point
├── samples/             # Sample CSV files for import
│   ├── zerodha_tradebook_sample.csv
│   └── README.md        # CSV format documentation
├── tests/
│   ├── unit/            # Unit tests (30 tests)
│   ├── integration/     # Integration tests (33 tests)
│   ├── e2e/             # End-to-end tests (22 tests)
│   ├── helpers/         # Test utilities
│   └── setup.js         # Test configuration
├── .github/
│   └── workflows/
│       └── test.yml     # CI/CD pipeline
├── jest.config.js       # Jest configuration
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## 🎯 How It Works

### 1. **Trade Entry & Analysis**
```
User logs trade → FinBERT analyzes emotion → Tags extracted → Saved to DB
                                                                    ↓
                                            (If exit data provided)
                                                                    ↓
                                        Gemini generates post-trade analysis
```

### 2. **Learning from Mistakes**
```
User has trading history → System analyzes patterns → Identifies mistakes
                                                              ↓
                                    Gemini generates personalized quiz/flashcards
                                                              ↓
                                    Based on actual trades and emotions
```

### 3. **Weekly Insights**
```
Every Sunday → System aggregates week's trades → Gemini analyzes performance
                                                              ↓
                                            Email sent with insights & recommendations
```

### 4. **Discipline & Pre-Trade Checklist**
```
User defines rules → System stores rules with thresholds
                                   ↓
User enters new trade → Pre-trade validation runs
                                   ↓
              ┌────────────────────┴────────────────────┐
              ↓                                          ↓
      Rules Pass                                  Rules Violated
         ↓                                             ↓
  Trade Created                              ┌─────────┴─────────┐
  Score = 100                                ↓                   ↓
         ↓                               Warn Only          Block Action
  Weekly Score Updated                      ↓                    ↓
                                    Trade Created           Trade Blocked
                                    with warnings          403 Response
                                         ↓                       ↓
                                   Score Reduced          Saved as blocked attempt
                                         ↓                for analytics
                                   Weekly Score Updated
```

## 🚀 Key Workflows

### Complete User Journey
1. **Register** → Create account with email/password
2. **Set Up Rules** → Define trading rules (time windows, position limits, etc.)
3. **Configure Checklist** → Add custom pre-trade questions
4. **Log Trades** → Enter trades with pre-trade emotional state and checklist
5. **Pre-Trade Validation** → System checks rules, warns/blocks violations
6. **Close Trades** → Add exit data (AI analysis generated automatically)
7. **Track Discipline** → View weekly discipline score and correlations
8. **Get Insights** → Receive weekly AI-powered insights via email
9. **Take Quiz** → Test knowledge with personalized questions from YOUR mistakes
10. **Study Flashcards** → Review lessons learned from YOUR trading history
11. **Improve** → Apply lessons and see improvement in statistics and discipline score

### Example: Learning from FOMO Mistakes
```
Day 1: Trader enters FOMO trade → Loses $500 → System detects "negative" emotion
Day 3: Trader enters another FOMO trade → Loses $300 → Pattern identified
Day 7: Trader requests quiz → Gets questions about FOMO based on actual trades
Day 10: Trader reviews flashcards → "What led to your $800 in FOMO losses?"
Day 15: Trader avoids FOMO trade → Sees improvement in weekly insights
```

### Example: Discipline System in Action
```
Setup: Trader creates rules → "Max 3 trades/day" (warn) + "Stop loss required" (block)

Day 1: Trade 1 with SL → ✅ Allowed (score 100)
Day 1: Trade 2 with SL → ✅ Allowed (score 100)
Day 1: Trade 3 with SL → ✅ Allowed (score 100)
Day 1: Trade 4 with SL → ⚠️ Allowed with warning "4th trade today" (score 85)
Day 1: Trade 5 no SL → ❌ BLOCKED "Stop loss required" (trade not created)

Day 2: Trader checks correlation → "Win rate 65% when compliant, 30% when not"
Day 7: Weekly report → Discipline score: 72%, most violated: MAX_DAILY_TRADES
        Recommendation: "Your TIME_WINDOW rule has 100% compliance - great!"
```

## 🧠 AI Intelligence Features

### Emotion Detection (FinBERT)
- Analyzes trade entry and exit reasons
- Detects: positive, negative, neutral sentiment
- Tracks emotional patterns across trades
- Identifies correlation between emotions and results

### Post-Trade Analysis (Gemini)
- Comprehensive analysis of completed trades
- Personalized recommendations
- Risk observations
- Pattern identification

### Personalized Learning (Gemini)
- **Quiz Generation**: Questions based on YOUR mistakes
  - References your actual trades
  - Includes your profit/loss amounts
  - Mentions specific symbols you traded
  - Addresses your emotional patterns

- **Flashcard Generation**: Study material from YOUR history
  - Top mistakes you've made
  - Lessons you've documented
  - AI recommendations you've received
  - Emotional triggers to avoid

### Weekly Insights (Gemini)
- Performance summary
- Emotion analysis
- Strategy effectiveness
- Actionable recommendations

## 📊 Test Coverage Details

### What's Tested
✅ **Authentication & Authorization**
- User registration with validation
- Login with JWT tokens
- Protected route access

✅ **Trade Management**
- Creating open and closed trades
- Automatic emotion detection
- Tag extraction from reasons
- Post-trade AI analysis
- Statistics calculation

✅ **AI Services**
- FinBERT emotion detection
- Gemini quiz generation
- Gemini flashcard generation
- Gemini weekly insights
- Cohere explanations

✅ **Learning Features**
- Trading pattern analysis
- Personalized quiz generation
- Personalized flashcard generation
- Mistake identification

✅ **Complete Workflows**
- Registration → Trading → Analysis → Learning
- Making mistakes → Getting insights → Improving
- Error handling and edge cases

### Running Tests Locally
```bash
# Ensure MongoDB is running
mongod

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Open coverage report
# coverage/lcov-report/index.html
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. **Write tests** for your feature (maintain 80%+ coverage)
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to the branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

### Contribution Guidelines
- Write tests for all new features
- Follow existing code style
- Update documentation
- Ensure CI/CD pipeline passes

## License

This project is licensed under the MIT License - see the LICENSE file for details.

