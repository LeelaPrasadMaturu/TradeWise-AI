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
  "tags": ["breakout", "volume"]
}
```
The system will automatically:
- Analyze the trade reason for emotional content using FinBERT
- Extract relevant trading strategy tags
- Combine them with user-provided tags

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

- [ ] Demat Account Integration
  - Direct connection with your trading account
  - Automated trade entry and tracking
  - Simplified trade logging - just enter your trading rationale
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
│   ├── models/          # MongoDB models (User, Trade, Alert)
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   │   ├── emotionDetectService.js    # FinBERT emotion detection
│   │   ├── quizFlashcardService.js    # Personalized learning
│   │   ├── insightsService.js         # Weekly insights
│   │   ├── postTradeAnalysisService.js # Post-trade AI analysis
│   │   └── aiExplainService.js        # Cohere explanations
│   └── server.js        # Express app entry point
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

## 🚀 Key Workflows

### Complete User Journey
1. **Register** → Create account with email/password
2. **Log Trades** → Enter trades with reasons (emotion detected automatically)
3. **Close Trades** → Add exit data (AI analysis generated automatically)
4. **Get Insights** → Receive weekly AI-powered insights via email
5. **Take Quiz** → Test knowledge with personalized questions from YOUR mistakes
6. **Study Flashcards** → Review lessons learned from YOUR trading history
7. **Improve** → Apply lessons and see improvement in statistics

### Example: Learning from FOMO Mistakes
```
Day 1: Trader enters FOMO trade → Loses $500 → System detects "negative" emotion
Day 3: Trader enters another FOMO trade → Loses $300 → Pattern identified
Day 7: Trader requests quiz → Gets questions about FOMO based on actual trades
Day 10: Trader reviews flashcards → "What led to your $800 in FOMO losses?"
Day 15: Trader avoids FOMO trade → Sees improvement in weekly insights
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

