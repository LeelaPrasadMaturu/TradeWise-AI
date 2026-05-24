# Sample CSV Files for Trade Import

This folder contains sample CSV files that demonstrate the expected format for importing trades from various brokers.

## Zerodha Tradebook Format

File: `zerodha_tradebook_sample.csv`

This matches the exact format you get when downloading your tradebook from Zerodha Console:

### How to Download from Zerodha

1. Login to [console.zerodha.com](https://console.zerodha.com)
2. Go to **Reports** > **Tradebook**
3. Select the **Segment** (Equity, F&O, etc.)
4. Select the **Date Range** (max 365 days per export)
5. Click **View** to load trades
6. Click the **Download** icon and select **CSV**

### Expected Columns

| Column | Description | Required |
|--------|-------------|----------|
| `trade_date` | Date of trade execution (YYYY-MM-DD) | Yes |
| `exchange` | Exchange code (NSE, BSE) | No |
| `symbol` | Stock/instrument symbol | Yes |
| `trade_type` | "buy" or "sell" (also accepts "B" or "S") | Yes |
| `quantity` | Number of shares traded | Yes |
| `price` | Execution price per share | Yes |
| `order_id` | Broker order ID | No |
| `trade_id` | Exchange trade ID | No |

### Sample Data Explanation

The sample file contains trades that demonstrate:

1. **Complete trades** - Buy followed by sell (RELIANCE, TCS, TATAMOTORS)
2. **Losing trades** - Exit below entry (INFY, ICICIBANK)
3. **Partial exits** - Multiple sells for single buy (WIPRO)
4. **Scaling in** - Multiple buys before single exit (SBIN)
5. **Open positions** - Buy with no matching sell (HDFCBANK)

## Using the Import API

### 1. Validate CSV (Dry Run)

```bash
curl -X POST http://localhost:3000/api/import/csv/validate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "csv": "trade_date,exchange,symbol,trade_type,quantity,price\n2024-03-15,NSE,RELIANCE,buy,10,2450.50"
  }'
```

### 2. Import Trades

```bash
curl -X POST http://localhost:3000/api/import/csv \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "csv": "<YOUR_CSV_CONTENT>",
    "broker": "auto",
    "includeOpen": true,
    "skipDuplicates": true
  }'
```

### Import Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `broker` | string | "auto" | Broker format: "auto", "zerodha", "generic" |
| `includeOpen` | boolean | true | Import open positions (buys without matching sells) |
| `skipDuplicates` | boolean | true | Skip trades that already exist |

## Trade Matching Logic

The importer uses **FIFO (First In, First Out)** matching:

1. Groups all executions by symbol
2. Sorts buys and sells by date
3. Matches each sell against the oldest available buy
4. Calculates P/L: `(exitPrice - entryPrice) * quantity`
5. Remaining unmatched buys become "open" positions

### Example

Given these executions:
```
2024-03-22: Buy 50 SBIN @ 780.25
2024-03-22: Buy 50 SBIN @ 775.00  
2024-03-25: Sell 100 SBIN @ 795.50
```

The importer creates:
- Trade 1: Buy 50 @ 780.25, Sell 50 @ 795.50 → P/L: ₹762.50
- Trade 2: Buy 50 @ 775.00, Sell 50 @ 795.50 → P/L: ₹1,025.00

## Generic CSV Format

If your broker isn't specifically supported, use the generic format with these minimum columns:

```csv
date,symbol,type,quantity,price
2024-03-15,RELIANCE,buy,10,2450.50
2024-03-15,RELIANCE,sell,10,2485.75
```

The importer will auto-detect the format based on column headers.
