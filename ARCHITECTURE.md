# TradeWise AI - System Architecture

## Overview

TradeWise AI is a full-stack trading journal and behavioral analytics platform that combines AI-powered analysis with comprehensive trade tracking and emotional intelligence.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  Next.js 16 + React 19 + TypeScript                                         │    │
│  │  ├── TanStack Query v5 (server state management)                            │    │
│  │  ├── shadcn/ui + Tailwind CSS v4 (styling)                                  │    │
│  │  ├── Recharts v3 (equity curve visualization)                               │    │
│  │  └── react-hook-form + Zod v4 (form validation)                             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                             │
│                              JWT (httpOnly cookie)                                   │
└────────────────────────────────────────┼────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND                                           │
│                                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │ Express API  │───▶│ Middlewares  │───▶│         SERVICES LAYER              │   │
│  │   Layer      │    │  • auth.js   │    │         (16 services)               │   │
│  │              │    │  • error.js  │    │                                     │   │
│  └──────────────┘    └──────────────┘    │  ┌─────────────────────────────┐    │   │
│                                          │  │ BEHAVIORAL ANALYTICS        │    │   │
│                                          │  │  • behavioralPatternService │    │   │
│                                          │  │  • disciplineScoreService   │    │   │
│  ┌──────────────────────────────────┐   │  │  • ruleValidationService    │    │   │
│  │     BACKGROUND PROCESSES         │   │  └─────────────────────────────┘    │   │
│  │                                  │   │                                     │   │
│  │  ┌────────────────────────────┐  │   │  ┌─────────────────────────────┐    │   │
│  │  │ Scheduler (node-cron)      │  │   │  │ AI COACHING                 │    │   │
│  │  │  • 8:30 AM Pre-Market     │──┼──▶│  │  • tradingCoachService      │    │   │
│  │  │  • Sunday Weekly Insights │  │   │  │  • mistakeFlashbackService  │    │   │
│  │  └────────────────────────────┘  │   │  │  • postTradeAnalysisService │    │   │
│  │                                  │   │  └─────────────────────────────┘    │   │
│  │  ┌────────────────────────────┐  │   │                                     │   │
│  │  │ Alert Monitor (60s loop)  │──┼──▶│  ┌─────────────────────────────┐    │   │
│  │  │  • Price alerts           │  │   │  │ DATA PROCESSING             │    │   │
│  │  │  • Multi-asset support    │  │   │  │  • csvImportService (FIFO)  │    │   │
│  │  └────────────────────────────┘  │   │  │  • taxReportService         │    │   │
│  └──────────────────────────────────┘   │  │  • insightsService          │    │   │
│                                          │  └─────────────────────────────┘    │   │
│                                          │                                     │   │
│                                          │  ┌─────────────────────────────┐    │   │
│                                          │  │ LEARNING                    │    │   │
│                                          │  │  • quizFlashcardService     │    │   │
│                                          │  │  • aiExplainService         │    │   │
│                                          │  │  • emotionDetectService     │    │   │
│                                          │  └─────────────────────────────┘    │   │
│                                          └─────────────────────────────────────┘   │
│                                                         │                          │
└─────────────────────────────────────────────────────────┼──────────────────────────┘
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────────┐
                    │                                     │                         │
                    ▼                                     ▼                         ▼
┌─────────────────────────┐  ┌─────────────────────────────────────┐  ┌─────────────────┐
│      EXTERNAL APIs      │  │           AI MODELS                 │  │    DATABASE     │
│                         │  │                                     │  │                 │
│  ┌───────────────────┐  │  │  ┌─────────────────────────────┐   │  │  ┌───────────┐  │
│  │ CoinGecko         │  │  │  │ Google Gemini 2.0 Flash     │   │  │  │ MongoDB   │  │
│  │ (crypto prices)   │  │  │  │  • Post-trade analysis      │   │  │  │           │  │
│  └───────────────────┘  │  │  │  • Pre-market focus areas   │   │  │  │ 7 Models: │  │
│                         │  │  │  • Weekly insights          │   │  │  │ • Trade   │  │
│  ┌───────────────────┐  │  │  │  • Quiz/flashcard gen       │   │  │  │ • User    │  │
│  │ SMTP Server       │  │  │  └─────────────────────────────┘   │  │  │ • Rules   │  │
│  │ (Email delivery)  │  │  │                                     │  │  │ • Alerts  │  │
│  └───────────────────┘  │  │  ┌─────────────────────────────┐   │  │  │ • Config  │  │
│                         │  │  │ HuggingFace FinBERT         │   │  │  │ • Baseline│  │
│                         │  │  │  • Sentiment classification │   │  │  │ • Checks  │  │
│                         │  │  │  • Emotion mapping          │   │  │  └───────────┘  │
│                         │  │  └─────────────────────────────┘   │  │                 │
│                         │  │                                     │  │                 │
│                         │  │  ┌─────────────────────────────┐   │  │                 │
│                         │  │  │ Cohere Command-A            │   │  │                 │
│                         │  │  │  • Term explanations        │   │  │                 │
│                         │  │  │  • 4 literacy levels        │   │  │                 │
│                         │  │  └─────────────────────────────┘   │  │                 │
└─────────────────────────┘  └─────────────────────────────────────┘  └─────────────────┘
```

---

## Services Layer Detail (16 Services)

### Behavioral Analytics
| Service | Lines | Purpose |
|---------|-------|---------|
| `behavioralPatternService.js` | 1,349 | 19 pattern detectors (15 negative + 4 positive), style-adaptive thresholds |
| `disciplineScoreService.js` | ~400 | Period scores, compliance breakdown, win-rate correlation |
| `ruleValidationService.js` | ~700 | 13 rule types, pre-trade validation, block/warn actions |

### AI Coaching
| Service | Lines | Purpose |
|---------|-------|---------|
| `tradingCoachService.js` | ~730 | Real-time alerts (7 types), pre-market briefings, Gemini focus areas |
| `mistakeFlashbackService.js` | ~430 | Pre-trade warnings from personal history |
| `postTradeAnalysisService.js` | ~220 | Behavioral checks + Gemini narrative analysis |

### Data Processing
| Service | Lines | Purpose |
|---------|-------|---------|
| `csvImportService.js` | ~520 | Broker CSV import, FIFO matching, F&O regex parsing |
| `taxReportService.js` | ~490 | ITR-ready reports, STCG/LTCG, F&O turnover |
| `insightsService.js` | ~300 | Weekly performance reports via Gemini |

### Learning & Intelligence
| Service | Lines | Purpose |
|---------|-------|---------|
| `quizFlashcardService.js` | ~410 | Personalized quizzes from trading mistakes |
| `aiExplainService.js` | ~100 | Cohere-powered term explanations |
| `emotionDetectService.js` | ~170 | FinBERT sentiment + keyword fallback |

### Infrastructure
| Service | Lines | Purpose |
|---------|-------|---------|
| `schedulerService.js` | ~190 | node-cron for pre-market briefings |
| `alertMonitorService.js` | ~190 | 60s price monitoring loop |
| `emailService.js` | ~150 | Nodemailer SMTP delivery |
| `priceService.js` | ~100 | CoinGecko crypto prices (1-min cache) |

---

## Data Models (7 Mongoose Models)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Trade (~290 lines)                       │
│  Central entity with market data, psychology, discipline,        │
│  behavioral flags, and AI analysis output                        │
├─────────────────────────────────────────────────────────────────┤
│  • Market: symbol, prices, quantity, direction, P&L             │
│  • Tax: segment, instrumentType, charges (STT, GST, etc.)       │
│  • Psychology: emotionAnalysis, preTradeEmotion (13 states)     │
│  • Discipline: ruleCheck ref, disciplineScore, rulesViolated[]  │
│  • AI: postTradeAnalysis (Gemini summary, recommendations)      │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    User       │    │ TradingRule   │    │ UserBaseline  │
│  Auth + prefs │    │  14 types     │    │  Style + 20+  │
│               │    │  warn/block   │    │  metrics      │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│UserTradingConf│    │TradeRuleCheck │    │  TradeAlert   │
│ Capital, lists│    │ Audit trail   │    │ Price triggers│
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## Key Data Flows

### 1. Trade Entry Flow
```
User Input → Frontend Form → POST /api/trades
                                    │
                                    ▼
                          ruleValidationService
                          ├── 13 rule checks
                          ├── Custom checklist
                          └── Emotional state gate
                                    │
                                    ▼
                          emotionDetectService (FinBERT)
                          └── Sentiment: positive/negative/neutral
                                    │
                                    ▼
                          Trade saved with disciplineScore
                                    │
                                    ▼
                          postTradeAnalysisService (if exit data)
                          ├── 5 behavioral pattern checks
                          └── Gemini narrative generation
```

### 2. Pre-Market Briefing Flow
```
8:30 AM IST (Mon-Fri) → schedulerService (node-cron)
                                    │
                                    ▼
                          tradingCoachService.generatePreMarketBriefing()
                          ├── Yesterday's P&L summary
                          ├── Rules violated
                          ├── Best/worst hours
                          ├── Day-of-week warning
                          ├── Gemini focus areas
                          └── Game plan (avoid/focus/rules)
                                    │
                                    ▼
                          emailService → User inbox (SMTP)
```

### 3. CSV Import Flow
```
CSV Upload → POST /api/import/csv
                    │
                    ▼
          csvImportService
          ├── Broker detection (Zerodha/generic)
          ├── Parse & normalize
          ├── FIFO buy/sell matching
          └── F&O regex detection
                    │
                    ▼
          Trades created → behavioralPatternService.recalculateBaseline()
```

### 4. Tax Report Flow
```
GET /api/reports/tax?fy=2024-25
                    │
                    ▼
          taxReportService.generateTaxReport()
          ├── Filter trades by FY (Apr-Mar)
          ├── Classify STCG/LTCG (365-day rule)
          ├── Calculate F&O turnover (Σ|P&L|)
          └── Aggregate charges
                    │
                    ▼
          Return: equity breakdown, F&O summary, by-month, by-symbol
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 16.2.6 (App Router)
- **UI Library**: React 19.2.4
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4, shadcn/ui (base-nova)
- **State**: TanStack Query v5 (server state)
- **Forms**: react-hook-form + Zod v4
- **Charts**: Recharts v3
- **Dates**: date-fns v4, react-day-picker v10

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 4.18
- **Database**: MongoDB with Mongoose 8.1
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Scheduling**: node-cron
- **Email**: Nodemailer
- **Validation**: Joi
- **Logging**: Winston + Morgan

### AI Services
- **Google Gemini 2.0 Flash**: Post-trade analysis, briefings, quizzes
- **HuggingFace FinBERT**: Financial sentiment classification
- **Cohere Command-A**: Trading term explanations

### External APIs
- **CoinGecko**: Cryptocurrency price data
- **SMTP**: Email delivery

---

## Behavioral Pattern Detection

### 15 Negative Patterns
1. `REVENGE_TRADING` - Entry after loss within style-specific window
2. `TILT_STREAK` - Consecutive losses (2-6 based on style)
3. `OVERTRADING` - Exceeds daily average × multiplier
4. `RAPID_FIRE` - Multiple trades in short window
5. `POSITION_SIZE_DRIFT_UP` - Overconfidence after wins
6. `POSITION_SIZE_DRIFT_DOWN` - Fear after losses
7. `POSITION_SIZE_CHAOS` - High size variance (CV > 0.8)
8. `TIME_OF_DAY_BIAS_NEGATIVE` - Poor hour performance
9. `DAY_OF_WEEK_BIAS_NEGATIVE` - Poor day performance
10. `SYMBOL_LOSS_CLUSTERING` - Symbol win rate < 35%
11. `FIRST_TRADE_SYNDROME` - First trade underperformance
12. `LOSS_AVERSION` - Holding losers longer than winners
13. `NEGATIVE_EMOTION_TRADING` - Trading with fear/anxiety
14. `FOMO_ENTRY` - Keyword detection + performance analysis
15. `STOP_LOSS_VIOLATION` - Exit beyond stated SL

### 4 Positive Patterns
1. `CONSISTENT_SIZING` - Low position size variance
2. `STOP_LOSS_DISCIPLINE` - >80% trades have SL
3. `EMOTIONAL_NEUTRALITY` - >60% neutral emotion
4. `RECOVERY_PATIENCE` - Proper wait after losses

### Style-Adaptive Thresholds
| Style | Revenge Window | Tilt Streak | Overtrading Multiplier |
|-------|----------------|-------------|------------------------|
| SCALPER | 10 min | 6 losses | 2× |
| INTRADAY | 120 min | 4 losses | 3× |
| SWING | 24 hours | 3 losses | 5× |
| POSITIONAL | 3 days | 2 losses | 10× |

---

## Project Structure

```
TradeWise-AI/
├── package.json              # Root orchestrator (npm workspaces)
├── README.md                 # Project documentation
├── ARCHITECTURE.md           # This file
├── ROADMAP.md               # Feature roadmap
├── LICENSE
├── .gitignore
│
├── backend/
│   ├── package.json          # Backend dependencies
│   ├── .env.example          # Environment template
│   ├── jest.config.js        # Test configuration
│   ├── server.js             # Express entry point
│   ├── config/
│   │   ├── constants.js
│   │   ├── db.js
│   │   └── swagger.js
│   ├── controllers/
│   ├── middlewares/
│   │   ├── auth.js
│   │   └── error.js
│   ├── models/               # 7 Mongoose models
│   │   ├── Trade.js
│   │   ├── User.js
│   │   ├── TradingRule.js
│   │   ├── TradeRuleCheck.js
│   │   ├── UserBaseline.js
│   │   ├── UserTradingConfig.js
│   │   └── TradeAlert.js
│   ├── routes/
│   ├── services/             # 16 service files
│   ├── tests/                # 85+ tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── samples/              # Sample CSV files
│
└── frontend/
    ├── package.json          # Frontend dependencies
    ├── .env.local            # Frontend env (API URL)
    ├── app/                  # Next.js App Router
    │   ├── (auth)/           # Login, Register
    │   ├── (dashboard)/      # Protected pages
    │   └── page.tsx          # Landing page
    ├── components/           # 51 components
    ├── lib/
    │   ├── api.ts            # API client
    │   └── utils.ts
    └── types/
```

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/tradewise

# Authentication
JWT_SECRET=your-secret-key

# AI Services
GOOGLE_AI_API_KEY=your-gemini-key
HUGGINGFACE_API_KEY=your-hf-key
COHERE_API_KEY=your-cohere-key

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-app-password
SMTP_FROM="TradeWise AI" <coach@tradewise.ai>
```
