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
  trade_time: ['trade_time', 'time', 'order_time', 'execution_time'],
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
  
  // Try ISO format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const [, year, month, day, hours, minutes, seconds] = isoMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (hours) {
      d.setHours(parseInt(hours), parseInt(minutes) || 0, parseInt(seconds) || 0);
    }
    return d;
  }

  // Try DD-MM-YYYY or DD/MM/YYYY (with optional time)
  const indianMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (indianMatch) {
    const [, day, month, year, hours, minutes, seconds] = indianMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (hours) {
      d.setHours(parseInt(hours), parseInt(minutes) || 0, parseInt(seconds) || 0);
    }
    return d;
  }

  // Fallback: let JS parse it
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Combine a parsed date with a time string (HH:MM or HH:MM:SS)
 */
function combineDateTime(date, timeStr) {
  if (!timeStr || !date) return date;
  
  const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const [, hours, minutes, seconds] = timeMatch;
    const combined = new Date(date);
    combined.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds) || 0);
    return combined;
  }
  return date;
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
 * Detect if symbol is an F&O instrument and extract metadata
 * Returns: { segment, instrumentType, optionType, strikePrice, contractExpiry, baseSymbol }
 * 
 * Symbol formats:
 * - Options monthly: NIFTY26MAR22000CE (base + YY + MMM + strike + CE/PE)
 * - Options weekly: NIFTY26MAR2722000CE (base + YY + MMM + DD + strike + CE/PE)
 * - Futures monthly: NIFTY26MARFUT (base + YY + MMM + FUT)
 * - Futures weekly: NIFTY26MAR27FUT (base + YY + MMM + DD + FUT)
 * - Stock Futures: RELIANCE26MARFUT
 */
function detectFnOInstrument(symbol) {
  const result = {
    segment: 'equity',
    instrumentType: 'stock',
    optionType: null,
    strikePrice: null,
    contractExpiry: null,
    baseSymbol: symbol
  };

  if (!symbol) return result;

  const upperSymbol = symbol.toUpperCase();

  // Pattern for Futures: NIFTY26MARFUT, NIFTY26MAR27FUT, RELIANCE26MARFUT
  const futuresPattern = /^([A-Z]+)(\d{2})([A-Z]{3})(\d{0,2})FUT$/i;
  const futuresMatch = upperSymbol.match(futuresPattern);
  if (futuresMatch) {
    const [, base, year, month, day] = futuresMatch;
    result.segment = 'fno';
    result.instrumentType = 'futures';
    result.baseSymbol = base;
    result.contractExpiry = parseExpiryDate(year, month, day);
    return result;
  }

  // Pattern for Options with day (weekly): NIFTY26MAR2722000CE
  // Day is exactly 2 digits before the strike (which is typically 4-6 digits)
  const weeklyOptionsPattern = /^([A-Z]+)(\d{2})([A-Z]{3})(\d{2})(\d{4,6})(CE|PE)$/i;
  const weeklyMatch = upperSymbol.match(weeklyOptionsPattern);
  if (weeklyMatch) {
    const [, base, year, month, day, strike, optType] = weeklyMatch;
    result.segment = 'fno';
    result.instrumentType = 'options';
    result.baseSymbol = base;
    result.strikePrice = parseFloat(strike);
    result.optionType = optType.toUpperCase();
    result.contractExpiry = parseExpiryDate(year, month, day);
    return result;
  }

  // Pattern for Options without day (monthly): NIFTY26MAR22000CE
  // No day, strike is typically 4-6 digits
  const monthlyOptionsPattern = /^([A-Z]+)(\d{2})([A-Z]{3})(\d{4,6})(CE|PE)$/i;
  const monthlyMatch = upperSymbol.match(monthlyOptionsPattern);
  if (monthlyMatch) {
    const [, base, year, month, strike, optType] = monthlyMatch;
    result.segment = 'fno';
    result.instrumentType = 'options';
    result.baseSymbol = base;
    result.strikePrice = parseFloat(strike);
    result.optionType = optType.toUpperCase();
    result.contractExpiry = parseExpiryDate(year, month, '');
    return result;
  }

  // Pattern for BankNifty options (5 digit strikes): BANKNIFTY26MAR48000CE
  const bankNiftyPattern = /^(BANKNIFTY)(\d{2})([A-Z]{3})(\d{2})?(\d{5})(CE|PE)$/i;
  const bankNiftyMatch = upperSymbol.match(bankNiftyPattern);
  if (bankNiftyMatch) {
    const [, base, year, month, day, strike, optType] = bankNiftyMatch;
    result.segment = 'fno';
    result.instrumentType = 'options';
    result.baseSymbol = base;
    result.strikePrice = parseFloat(strike);
    result.optionType = optType.toUpperCase();
    result.contractExpiry = parseExpiryDate(year, month, day || '');
    return result;
  }

  // Generic fallback: anything ending in CE/PE with numbers is likely options
  const genericOptionsPattern = /^([A-Z]+).*(\d{4,6})(CE|PE)$/i;
  const genericMatch = upperSymbol.match(genericOptionsPattern);
  if (genericMatch) {
    const [, base, strike, optType] = genericMatch;
    result.segment = 'fno';
    result.instrumentType = 'options';
    result.baseSymbol = base;
    result.strikePrice = parseFloat(strike);
    result.optionType = optType.toUpperCase();
    return result;
  }

  // Check for index instruments (NIFTY, BANKNIFTY, FINNIFTY, etc.)
  const indexSymbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'];
  if (indexSymbols.includes(upperSymbol)) {
    result.instrumentType = 'index';
  }

  return result;
}

/**
 * Parse expiry date from year, month, and optional day
 */
function parseExpiryDate(year, month, day) {
  const months = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
  };
  
  const fullYear = 2000 + parseInt(year);
  const monthIndex = months[month.toUpperCase()] || 0;
  const dayOfMonth = day ? parseInt(day) : getLastThursday(fullYear, monthIndex);
  
  return new Date(fullYear, monthIndex, dayOfMonth);
}

/**
 * Get the last Thursday of a month (typical F&O expiry)
 */
function getLastThursday(year, month) {
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay();
  const diff = (dayOfWeek >= 4) ? (dayOfWeek - 4) : (dayOfWeek + 3);
  return lastDay.getDate() - diff;
}

/**
 * Parse Zerodha tradebook CSV
 */
function parseZerodhaTradebook(headers, rows) {
  const colMap = {
    date: findColumn(headers, ZERODHA_COLUMNS.trade_date) || findColumn(headers, ['date']),
    time: findColumn(headers, ZERODHA_COLUMNS.trade_time),
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

  const executions = rows.map(row => {
    let date = parseDate(row[colMap.date]);
    if (colMap.time && row[colMap.time]) {
      date = combineDateTime(date, row[colMap.time]);
    }
    return {
      date,
      symbol: row[colMap.symbol]?.toUpperCase(),
      type: normalizeTradeType(row[colMap.type]),
      quantity: parseFloat(row[colMap.quantity]) || 0,
      price: parseFloat(row[colMap.price]) || 0,
      exchange: row[colMap.exchange] || 'NSE',
      orderId: row[colMap.orderId] || null,
      tradeId: row[colMap.tradeId] || null
    };
  }).filter(exec => exec.symbol && exec.quantity > 0 && exec.price > 0);

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
          // Detect F&O instrument metadata
          const fnoInfo = detectFnOInstrument(symbol);
          
          // Create a trade
          trades.push({
            symbol,
            entryPrice: buy.price,
            exitPrice: sell.price,
            quantity: matchQty,
            direction: 'long', // Buy then sell = long position
            tradeDate: buy.date,
            exitDate: sell.date,
            exitTime: sell.date,
            entryTime: buy.date,
            exchange: buy.exchange,
            assetType: fnoInfo.segment === 'fno' ? 'stock' : 'stock',
            segment: fnoInfo.segment,
            instrumentType: fnoInfo.instrumentType,
            optionType: fnoInfo.optionType,
            strikePrice: fnoInfo.strikePrice,
            contractExpiry: fnoInfo.contractExpiry,
            source: 'csv_import',
            brokerData: {
              entryOrderId: buy.orderId,
              exitOrderId: sell.orderId,
              entryTradeId: buy.tradeId,
              exitTradeId: sell.tradeId,
              exchange: buy.exchange
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
        const fnoInfo = detectFnOInstrument(symbol);
        // For now, treat unmatched sells as potential short positions (open)
        openPositions.push({
          symbol,
          entryPrice: sell.price,
          quantity: remainingSellQty,
          direction: 'short',
          tradeDate: sell.date,
          entryTime: sell.date,
          exchange: sell.exchange,
          assetType: 'stock',
          segment: fnoInfo.segment,
          instrumentType: fnoInfo.instrumentType,
          optionType: fnoInfo.optionType,
          strikePrice: fnoInfo.strikePrice,
          contractExpiry: fnoInfo.contractExpiry,
          result: 'open',
          source: 'csv_import',
          notes: 'Short position - no matching buy found'
        });
      }
    });
    
    // Remaining buys are open positions
    buyQueue.forEach(buy => {
      if (buy.quantity > 0) {
        const fnoInfo = detectFnOInstrument(symbol);
        openPositions.push({
          symbol,
          entryPrice: buy.price,
          quantity: buy.quantity,
          direction: 'long',
          tradeDate: buy.date,
          entryTime: buy.date,
          exchange: buy.exchange,
          assetType: 'stock',
          segment: fnoInfo.segment,
          instrumentType: fnoInfo.instrumentType,
          optionType: fnoInfo.optionType,
          strikePrice: fnoInfo.strikePrice,
          contractExpiry: fnoInfo.contractExpiry,
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
  detectFnOInstrument,
  SUPPORTED_BROKERS
};
