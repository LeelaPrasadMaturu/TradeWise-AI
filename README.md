# TradeWise AI - Intelligent Trading Assistant

TradeWise AI is a sophisticated trading assistant that combines AI-powered analysis with comprehensive trade tracking and emotional intelligence to help traders make better decisions.

## Features

- 🤖 AI-powered trade analysis and explanations
- 📊 Comprehensive trade tracking and statistics
- 🎯 Strategy and pattern recognition
- 😊 Emotional state analysis for better decision making
- 📈 Performance analytics and insights
- 🔒 Secure user authentication and data protection
- 📧 Weekly AI-powered market insights delivered to your email every Sunday
- 🤖 Direct integration with Gemini AI for intelligent market analysis


## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **AI Services**: 
  - Cohere AI (for natural language processing)
  - Hugging Face (for emotion detection)
  - Google gemini api ( For weekly insights )
- **Authentication**: JWT

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- API keys for:
  - Cohere AI
  - Hugging Face
  - OpenAI

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tradewise-ai.git
cd tradewise-ai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Server Configuration
PORT=3000
MONGODB_URI=your_mongodb_connection_string

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# AI Service API Keys
COHERE_API_KEY=your_cohere_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
OPENAI_API_KEY=your_openai_api_key
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

### 3. OpenAI API Key
1. Visit [Google Gemini Api](#)
2. Sign up for an account
3. Go to API Keys section
4. Create a new secret key
5. Copy the key to your `.env` file

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
- Analyze the trade reason for emotional content
- Extract relevant trading strategy tags
- Combine them with user-provided tags

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
- `level`: Expertise level (default: 'expert')

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

#### PATCH /api/alerts/:id
Update an existing alert.

#### DELETE /api/alerts/:id
Delete an alert.

#### GET /api/alerts/stats
Get alert statistics including:
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
- [ ] Interactive Quiz System
- [ ] Flashcard Game


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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

