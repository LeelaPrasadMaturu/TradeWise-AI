/**
 * CSV Import Service
 * Parses broker CSV exports and converts them to TradeWise trade format
 * Currently supports: Zerodha Tradebook
 */

const SUPPORTED_BROKERS = {
  ZERODHA: 'zerodha',
  GENERIC: 'generic'
};

/**
 * Zerodha Tradebook CSV columns:
 * trade_date, exchange, symbol, trade_type, quantity, price, order_id, trade_id
 * 
 * trade_type can be: "buy", "sell", "B", "S"
 */
const ZERODHA_COLUMNS = {
  trade_date: ['trade_date', 'date', 'trade date'],
  exchange: ['exchange', 'exch'],
  symbol: ['symbol', 'tradingsymbol', 'scrip', 'instrument'],
  trade_type: ['trade_type', 'type', 'side', 'buy/sell', 'order_type'],
  quantity: ['quantity', 'qty', 'filled qty', 'filled_qty'],
  price: ['price', 'trade_price', 'avg_price', 'average_price'],
  order_id: ['order_id', 'order id', 'orderid'],
  trade_id: ['trade_id', 'trade id', 'tradeid']
};

/**
 * Parse CSV string into array of objects
 */
function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header - handle both comma and tab delimiters
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map(val => val.replace(/^"|"$/g, '').trim());
}

/**
 * Detect broker format from CSV headers
 */
function detectBroker(headers) {
  const headerSet = new Set(headers.map(h => h.toLowerCase()));
  
  // Check for Zerodha-specific columns
  const zerodhaIndicators = ['trade_date', 'tradingsymbol', 'trade_type', 'exchange'];
  const zerodhaMatches = zerodhaIndicators.filter(col => 
    headers.some(h => ZERODHA_COLUMNS[col]?.includes(h.toLowerCase()) || h.toLowerCase() === col)
  );

  if (zerodhaMatches.length >= 2) {
    return SUPPORTED_BROKERS.ZERODHA;
  }

  // Check for generic format
  const hasSymbol = headers.some(h => ['symbol', 'scrip', 'instrument', 'stock'].includes(h.toLowerCase()));
  const hasPrice = headers.some(h => ['price', 'rate', 'avg_price'].includes(h.toLowerCase()));
  const hasQty = headers.some(h => ['quantity', 'qty', 'volume'].includes(h.toLowerCase()));

  if (hasSymbol && hasPrice && hasQty) {
    return SUPPORTED_BROKERS.GENERIC;
  }

  throw new Error('Unable to detect broker format. Please use Zerodha tradebook CSV or generic format.');
}

/**
 * Find the actual column name in headers that matches our expected column
 */
function findColumn(headers, columnAliases) {
  for (const alias of columnAliases) {
    const found = headers.find(h => h.toLowerCase() === alias.toLowerCase());
    if (found) return found;
  }
  return null;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  
  // Handle common formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, etc.
  const formats = [
    // ISO format
    /^(\d{4})-(\d{2})-(\d{2})/, // 2024-03-15
    // Indian format
    /^(\d{2})-(\d{2})-(\d{4})/, // 15-03-2024
    /^(\d{2})\/(\d{2})\/(\d{4})/, // 15/03/2024
  ];

  // Try ISO format first
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(dateStr);
  }

  // Try DD-MM-YYYY or DD/MM/YYYY
  const indianMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
  if (indianMatch) {
    const [, day, month, year] = indianMatch;
    return new Date(`${year}-${month}-${day}`);
  }

  // Fallback: let JS parse it
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Normalize trade type to 'buy' or 'sell'
 */
function normalizeTradeType(type) {
  const normalized = type.toLowerCase().trim();
  if (['buy', 'b', 'bought'].includes(normalized)) return 'buy';
  if (['sell', 's', 'sold'].includes(normalized)) return 'sell';
  return normalized;
}

/**
 * Parse Zerodha tradebook CSV
 */
function parseZerodhaTradebook(headers, rows) {
  const colMap = {
    date: findColumn(headers, ZERODHA_COLUMNS.trade_date) || findColumn(headers, ['date']),
    symbol: findColumn(headers, ZERODHA_COLUMNS.symbol),
    type: findColumn(headers, ZERODHA_COLUMNS.trade_type),
    quantity: findColumn(headers, ZERODHA_COLUMNS.quantity),
    price: findColumn(headers, ZERODHA_COLUMNS.price),
    exchange: findColumn(headers, ZERODHA_COLUMNS.exchange),
    orderId: findColumn(headers, ZERODHA_COLUMNS.order_id),
    tradeId: findColumn(headers, ZERODHA_COLUMNS.trade_id)
  };

  // Validate required columns
  if (!colMap.symbol) throw new Error('Missing symbol column in CSV');
  if (!colMap.type) throw new Error('Missing trade_type column in CSV');
  if (!colMap.quantity) throw new Error('Missing quantity column in CSV');
  if (!colMap.price) throw new Error('Missing price column in CSV');

  const executions = rows.map(row => ({
    date: parseDate(row[colMap.date]),
    symbol: row[colMap.symbol]?.toUpperCase(),
    type: normalizeTradeType(row[colMap.type]),
    quantity: parseFloat(row[colMap.quantity]) || 0,
    price: parseFloat(row[colMap.price]) || 0,
    exchange: row[colMap.exchange] || 'NSE',
    orderId: row[colMap.orderId] || null,
    tradeId: row[colMap.tradeId] || null
  })).filter(exec => exec.symbol && exec.quantity > 0 && exec.price > 0);

  return executions;
}

/**
 * Match buy and sell executions into complete trades
 * Uses FIFO (First In, First Out) matching
 */
function matchExecutionsToTrades(executions) {
  // Group by symbol
  const bySymbol = {};
  executions.forEach(exec => {
    if (!bySymbol[exec.symbol]) {
      bySymbol[exec.symbol] = { buys: [], sells: [] };
    }
    if (exec.type === 'buy') {
      bySymbol[exec.symbol].buys.push({ ...exec });
    } else {
      bySymbol[exec.symbol].sells.push({ ...exec });
    }
  });

  const trades = [];
  const openPositions = [];
  const errors = [];

  Object.entries(bySymbol).forEach(([symbol, { buys, sells }]) => {
    // Sort by date
    buys.sort((a, b) => a.date - b.date);
    sells.sort((a, b) => a.date - b.date);

    // FIFO matching
    const buyQueue = [...buys];
    
    sells.forEach(sell => {
      let remainingSellQty = sell.quantity;
      
      while (remainingSellQty > 0 && buyQueue.length > 0) {
        const buy = buyQueue[0];
        const matchQty = Math.min(buy.quantity, remainingSellQty);
        
        if (matchQty > 0) {
          // Create a trade
          trades.push({
            symbol,
            entryPrice: buy.price,
            exitPrice: sell.price,
            quantity: matchQty,
            direction: 'long', // Buy then sell = long position
            tradeDate: buy.date,
            exitDate: sell.date,
            exchange: buy.exchange,
            assetType: 'stock',
            source: 'csv_import',
            brokerData: {
              entryOrderId: buy.orderId,
              exitOrderId: sell.orderId,
              entryTradeId: buy.tradeId,
              exitTradeId: sell.tradeId
            }
          });
          
          buy.quantity -= matchQty;
          remainingSellQty -= matchQty;
          
          if (buy.quantity <= 0) {
            buyQueue.shift();
          }
        }
      }
      
      // If we couldn't match all sells, this might be a short position
      if (remainingSellQty > 0) {
        // For now, treat unmatched sells as potential short positions (open)
        openPositions.push({
          symbol,
          entryPrice: sell.price,
          quantity: remainingSellQty,
          direction: 'short',
          tradeDate: sell.date,
          exchange: sell.exchange,
          assetType: 'stock',
          result: 'open',
          source: 'csv_import',
          notes: 'Short position - no matching buy found'
        });
      }
    });
    
    // Remaining buys are open positions
    buyQueue.forEach(buy => {
      if (buy.quantity > 0) {
        openPositions.push({
          symbol,
          entryPrice: buy.price,
          quantity: buy.quantity,
          direction: 'long',
          tradeDate: buy.date,
          exchange: buy.exchange,
          assetType: 'stock',
          result: 'open',
          source: 'csv_import',
          notes: 'Open position - no exit found'
        });
      }
    });
  });

  // Calculate P/L for completed trades
  trades.forEach(trade => {
    const multiplier = trade.direction === 'long' ? 1 : -1;
    trade.profitLoss = (trade.exitPrice - trade.entryPrice) * trade.quantity * multiplier;
    
    if (trade.profitLoss > 0) {
      trade.result = 'win';
    } else if (trade.profitLoss < 0) {
      trade.result = 'loss';
    } else {
      trade.result = 'breakeven';
    }
  });

  return { trades, openPositions, errors };
}

/**
 * Main import function
 * @param {string} csvString - Raw CSV content
 * @param {object} options - Import options
 * @returns {object} - Parsed trades and import statistics
 */
function importFromCSV(csvString, options = {}) {
  const { broker = 'auto' } = options;

  // Parse CSV
  const { headers, rows } = parseCSV(csvString);
  
  if (rows.length === 0) {
    throw new Error('No data rows found in CSV');
  }

  // Detect or validate broker
  const detectedBroker = broker === 'auto' ? detectBroker(headers) : broker;

  // Parse based on broker format
  let executions;
  switch (detectedBroker) {
    case SUPPORTED_BROKERS.ZERODHA:
      executions = parseZerodhaTradebook(headers, rows);
      break;
    case SUPPORTED_BROKERS.GENERIC:
      executions = parseZerodhaTradebook(headers, rows); // Generic uses same logic
      break;
    default:
      throw new Error(`Unsupported broker: ${detectedBroker}`);
  }

  // Match executions to trades
  const { trades, openPositions, errors } = matchExecutionsToTrades(executions);

  return {
    broker: detectedBroker,
    summary: {
      totalExecutions: rows.length,
      parsedExecutions: executions.length,
      completedTrades: trades.length,
      openPositions: openPositions.length,
      errors: errors.length
    },
    trades,
    openPositions,
    errors
  };
}

/**
 * Validate CSV before import (dry run)
 */
function validateCSV(csvString) {
  try {
    const result = importFromCSV(csvString);
    return {
      valid: true,
      broker: result.broker,
      summary: result.summary,
      preview: {
        trades: result.trades.slice(0, 5),
        openPositions: result.openPositions.slice(0, 5)
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  importFromCSV,
  validateCSV,
  parseCSV,
  SUPPORTED_BROKERS
};
