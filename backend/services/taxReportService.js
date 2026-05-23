/**
 * Tax Report Service
 * Generates ITR-ready tax reports for Indian traders
 * Supports: Equity (STCG/LTCG), F&O turnover, capital gains summary
 */

const Trade = require('../models/Trade');

/**
 * Parse financial year string to date range
 * @param {string} fy - Financial year in format '2024-25' or '2024-2025'
 * @returns {{ start: Date, end: Date }}
 */
function parseFYToDateRange(fy) {
  const match = fy.match(/^(\d{4})-(\d{2,4})$/);
  if (!match) {
    throw new Error('Invalid financial year format. Use YYYY-YY (e.g., 2024-25)');
  }
  
  const startYear = parseInt(match[1]);
  const start = new Date(startYear, 3, 1); // April 1
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // March 31 next year
  
  return { start, end };
}

/**
 * Get current financial year string
 * @returns {string} e.g., '2024-25'
 */
function getCurrentFY() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${(year + 1).toString().slice(-2)}`;
}

/**
 * Get list of available financial years for a user
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getAvailableFYs(userId) {
  const oldestTrade = await Trade.findOne({ user: userId })
    .sort({ tradeDate: 1 })
    .select('tradeDate')
    .lean();
    
  if (!oldestTrade) return [getCurrentFY()];
  
  const startDate = new Date(oldestTrade.tradeDate);
  const startFY = startDate.getMonth() >= 3 ? startDate.getFullYear() : startDate.getFullYear() - 1;
  const currentFY = getCurrentFY();
  const currentYear = parseInt(currentFY.split('-')[0]);
  
  const fys = [];
  for (let year = startFY; year <= currentYear; year++) {
    fys.push(`${year}-${(year + 1).toString().slice(-2)}`);
  }
  
  return fys.reverse(); // Most recent first
}

/**
 * Classify trade as STCG or LTCG based on hold duration
 * Equity: LTCG if held > 12 months, STCG otherwise
 * Listed equity with STT paid: 10% LTCG (no indexation), 15% STCG
 */
function classifyCapitalGain(trade) {
  const entryDate = new Date(trade.tradeDate || trade.entryTime);
  const exitDate = new Date(trade.exitDate || trade.exitTime);
  
  if (!entryDate || !exitDate) return 'STCG'; // Default to STCG if dates missing
  
  const holdDays = Math.floor((exitDate - entryDate) / (1000 * 60 * 60 * 24));
  
  // For equity: > 12 months (365 days) = LTCG
  return holdDays > 365 ? 'LTCG' : 'STCG';
}

/**
 * Calculate F&O turnover as per income tax rules
 * Turnover = Sum of absolute profit/loss of each trade
 * (Not the total traded value)
 */
function calculateFnOTurnover(trades) {
  return trades.reduce((sum, trade) => {
    return sum + Math.abs(trade.profitLoss || 0);
  }, 0);
}

/**
 * Generate comprehensive tax report for a financial year
 * @param {string} userId
 * @param {string} financialYear - e.g., '2024-25'
 * @returns {Promise<Object>}
 */
async function generateTaxReport(userId, financialYear) {
  const { start, end } = parseFYToDateRange(financialYear);
  
  // Fetch all closed trades in the FY
  const trades = await Trade.find({
    user: userId,
    result: { $in: ['win', 'loss', 'breakeven'] },
    $or: [
      { exitDate: { $gte: start, $lte: end } },
      { exitTime: { $gte: start, $lte: end } },
      { 
        exitDate: { $exists: false },
        exitTime: { $exists: false },
        tradeDate: { $gte: start, $lte: end }
      }
    ]
  }).lean();

  // Initialize report structure
  const report = {
    financialYear,
    generatedAt: new Date(),
    dateRange: { start, end },
    
    equity: {
      stcg: {
        trades: [],
        totalPnL: 0,
        totalCharges: 0,
        netPnL: 0,
        tradeCount: 0,
        wins: 0,
        losses: 0
      },
      ltcg: {
        trades: [],
        totalPnL: 0,
        totalCharges: 0,
        netPnL: 0,
        tradeCount: 0,
        wins: 0,
        losses: 0
      }
    },
    
    fno: {
      futures: {
        trades: [],
        turnover: 0,
        netPnL: 0,
        totalCharges: 0,
        tradeCount: 0
      },
      options: {
        trades: [],
        turnover: 0,
        netPnL: 0,
        totalCharges: 0,
        tradeCount: 0
      },
      totalTurnover: 0,
      totalNetPnL: 0,
      totalCharges: 0,
      tradeCount: 0
    },
    
    summary: {
      totalPnL: 0,
      totalCharges: 0,
      netPnL: 0,
      totalTradeCount: 0,
      equityTradeCount: 0,
      fnoTradeCount: 0
    },
    
    byMonth: {},
    bySymbol: {}
  };

  // Process each trade
  for (const trade of trades) {
    const pnl = trade.profitLoss || 0;
    const charges = trade.charges?.totalCharges || 0;
    const netPnl = trade.netProfitLoss || (pnl - charges);
    const isWin = pnl > 0;
    const exitDate = new Date(trade.exitDate || trade.exitTime || trade.tradeDate);
    const monthKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Categorize trade
    const segment = trade.segment || 'equity';
    const instrumentType = trade.instrumentType || 'stock';
    
    // Build trade summary object
    const tradeSummary = {
      _id: trade._id,
      symbol: trade.symbol,
      direction: trade.direction,
      entryDate: trade.tradeDate || trade.entryTime,
      exitDate: exitDate,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      pnl,
      charges,
      netPnl,
      result: trade.result,
      exchange: trade.exchange || trade.brokerData?.exchange,
      segment,
      instrumentType,
      optionType: trade.optionType,
      strikePrice: trade.strikePrice
    };
    
    // Add to appropriate category
    if (segment === 'fno') {
      // F&O trades - treated as business income
      const fnoCategory = instrumentType === 'options' ? 'options' : 'futures';
      report.fno[fnoCategory].trades.push(tradeSummary);
      report.fno[fnoCategory].turnover += Math.abs(pnl);
      report.fno[fnoCategory].netPnL += pnl;
      report.fno[fnoCategory].totalCharges += charges;
      report.fno[fnoCategory].tradeCount++;
      
      report.fno.totalTurnover += Math.abs(pnl);
      report.fno.totalNetPnL += pnl;
      report.fno.totalCharges += charges;
      report.fno.tradeCount++;
      
      report.summary.fnoTradeCount++;
    } else {
      // Equity trades - capital gains
      const gainType = classifyCapitalGain(trade);
      const category = gainType.toLowerCase();
      
      tradeSummary.gainType = gainType;
      report.equity[category].trades.push(tradeSummary);
      report.equity[category].totalPnL += pnl;
      report.equity[category].totalCharges += charges;
      report.equity[category].netPnL += netPnl;
      report.equity[category].tradeCount++;
      if (isWin) report.equity[category].wins++;
      else if (pnl < 0) report.equity[category].losses++;
      
      report.summary.equityTradeCount++;
    }
    
    // Update summary
    report.summary.totalPnL += pnl;
    report.summary.totalCharges += charges;
    report.summary.netPnL += netPnl;
    report.summary.totalTradeCount++;
    
    // Monthly breakdown
    if (!report.byMonth[monthKey]) {
      report.byMonth[monthKey] = { pnl: 0, charges: 0, trades: 0 };
    }
    report.byMonth[monthKey].pnl += pnl;
    report.byMonth[monthKey].charges += charges;
    report.byMonth[monthKey].trades++;
    
    // Symbol breakdown
    const symbolKey = trade.symbol;
    if (!report.bySymbol[symbolKey]) {
      report.bySymbol[symbolKey] = { 
        pnl: 0, 
        charges: 0, 
        trades: 0,
        segment,
        instrumentType
      };
    }
    report.bySymbol[symbolKey].pnl += pnl;
    report.bySymbol[symbolKey].charges += charges;
    report.bySymbol[symbolKey].trades++;
  }
  
  // Sort byMonth
  report.byMonth = Object.fromEntries(
    Object.entries(report.byMonth).sort(([a], [b]) => a.localeCompare(b))
  );
  
  // Convert bySymbol to sorted array
  report.topSymbols = Object.entries(report.bySymbol)
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 20);

  return report;
}

/**
 * Generate capital gains summary for ITR filing
 * @param {string} userId
 * @param {string} financialYear
 * @returns {Promise<Object>}
 */
async function generateCapitalGainsSummary(userId, financialYear) {
  const report = await generateTaxReport(userId, financialYear);
  
  return {
    financialYear,
    generatedAt: new Date(),
    
    shortTermCapitalGains: {
      listedEquity: {
        totalGains: Math.max(0, report.equity.stcg.netPnL),
        totalLosses: Math.min(0, report.equity.stcg.netPnL),
        netGainLoss: report.equity.stcg.netPnL,
        taxRate: '15%',
        tradeCount: report.equity.stcg.tradeCount
      }
    },
    
    longTermCapitalGains: {
      listedEquity: {
        totalGains: Math.max(0, report.equity.ltcg.netPnL),
        totalLosses: Math.min(0, report.equity.ltcg.netPnL),
        netGainLoss: report.equity.ltcg.netPnL,
        taxRate: '10% (above Rs 1 lakh)',
        exemption: 100000,
        tradeCount: report.equity.ltcg.tradeCount
      }
    },
    
    summary: {
      totalSTCG: report.equity.stcg.netPnL,
      totalLTCG: report.equity.ltcg.netPnL,
      totalCapitalGains: report.equity.stcg.netPnL + report.equity.ltcg.netPnL
    }
  };
}

/**
 * Generate F&O turnover report for ITR business income
 * @param {string} userId
 * @param {string} financialYear
 * @returns {Promise<Object>}
 */
async function generateFnOTurnoverReport(userId, financialYear) {
  const report = await generateTaxReport(userId, financialYear);
  
  // Determine if tax audit is required
  // Audit required if: turnover > 10 crore (for digital transactions)
  // Or if profit < 6% of turnover and turnover > 2 crore
  const turnover = report.fno.totalTurnover;
  const netPnL = report.fno.totalNetPnL;
  const profitPercent = turnover > 0 ? (netPnL / turnover) * 100 : 0;
  
  let auditRequired = false;
  let auditReason = null;
  
  if (turnover > 100000000) { // 10 crore
    auditRequired = true;
    auditReason = 'Turnover exceeds Rs 10 crore';
  } else if (turnover > 20000000 && profitPercent < 6) { // 2 crore with <6% profit
    auditRequired = true;
    auditReason = 'Turnover exceeds Rs 2 crore with profit less than 6%';
  }
  
  return {
    financialYear,
    generatedAt: new Date(),
    
    turnoverCalculation: {
      futures: {
        absolutePnLSum: report.fno.futures.turnover,
        trades: report.fno.futures.tradeCount
      },
      options: {
        absolutePnLSum: report.fno.options.turnover,
        premiumReceived: 0, // Would need additional tracking
        trades: report.fno.options.tradeCount
      },
      totalTurnover: turnover
    },
    
    profitAndLoss: {
      grossPnL: report.fno.totalNetPnL + report.fno.totalCharges,
      charges: report.fno.totalCharges,
      netPnL: report.fno.totalNetPnL,
      profitPercentage: profitPercent.toFixed(2)
    },
    
    taxAudit: {
      required: auditRequired,
      reason: auditReason,
      turnoverThreshold: '10 crore (digital) / 2 crore (if profit < 6%)'
    },
    
    itrForm: netPnL >= 0 ? 'ITR-3' : 'ITR-3 (with loss)',
    
    notes: [
      'F&O trading is treated as non-speculative business income',
      'Losses can be set off against other business income',
      'Losses can be carried forward for 8 years',
      'Maintain books of accounts if turnover exceeds Rs 25 lakh'
    ]
  };
}

/**
 * Export tax report to CSV format
 * @param {Object} report - Tax report object
 * @returns {string} CSV string
 */
function exportToCSV(report) {
  const lines = [];
  
  // Header
  lines.push('TradeWise AI - Tax Report');
  lines.push(`Financial Year: ${report.financialYear}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleDateString('en-IN')}`);
  lines.push('');
  
  // Summary
  lines.push('=== SUMMARY ===');
  lines.push(`Total P&L,${report.summary.totalPnL.toFixed(2)}`);
  lines.push(`Total Charges,${report.summary.totalCharges.toFixed(2)}`);
  lines.push(`Net P&L,${report.summary.netPnL.toFixed(2)}`);
  lines.push(`Total Trades,${report.summary.totalTradeCount}`);
  lines.push('');
  
  // Equity STCG
  lines.push('=== EQUITY - SHORT TERM CAPITAL GAINS ===');
  lines.push('Symbol,Direction,Entry Date,Exit Date,Entry Price,Exit Price,Quantity,P&L,Charges,Net P&L');
  for (const trade of report.equity.stcg.trades) {
    lines.push([
      trade.symbol,
      trade.direction,
      new Date(trade.entryDate).toLocaleDateString('en-IN'),
      new Date(trade.exitDate).toLocaleDateString('en-IN'),
      trade.entryPrice,
      trade.exitPrice,
      trade.quantity,
      trade.pnl.toFixed(2),
      trade.charges.toFixed(2),
      trade.netPnl.toFixed(2)
    ].join(','));
  }
  lines.push(`STCG Total,,,,,,,,${report.equity.stcg.totalCharges.toFixed(2)},${report.equity.stcg.netPnL.toFixed(2)}`);
  lines.push('');
  
  // Equity LTCG
  lines.push('=== EQUITY - LONG TERM CAPITAL GAINS ===');
  lines.push('Symbol,Direction,Entry Date,Exit Date,Entry Price,Exit Price,Quantity,P&L,Charges,Net P&L');
  for (const trade of report.equity.ltcg.trades) {
    lines.push([
      trade.symbol,
      trade.direction,
      new Date(trade.entryDate).toLocaleDateString('en-IN'),
      new Date(trade.exitDate).toLocaleDateString('en-IN'),
      trade.entryPrice,
      trade.exitPrice,
      trade.quantity,
      trade.pnl.toFixed(2),
      trade.charges.toFixed(2),
      trade.netPnl.toFixed(2)
    ].join(','));
  }
  lines.push(`LTCG Total,,,,,,,,${report.equity.ltcg.totalCharges.toFixed(2)},${report.equity.ltcg.netPnL.toFixed(2)}`);
  lines.push('');
  
  // F&O
  lines.push('=== F&O - BUSINESS INCOME ===');
  lines.push('Symbol,Type,Direction,Entry Date,Exit Date,Entry Price,Exit Price,Quantity,P&L,Charges');
  const allFnOTrades = [...report.fno.futures.trades, ...report.fno.options.trades];
  for (const trade of allFnOTrades) {
    lines.push([
      trade.symbol,
      trade.instrumentType,
      trade.direction,
      new Date(trade.entryDate).toLocaleDateString('en-IN'),
      new Date(trade.exitDate).toLocaleDateString('en-IN'),
      trade.entryPrice,
      trade.exitPrice,
      trade.quantity,
      trade.pnl.toFixed(2),
      trade.charges.toFixed(2)
    ].join(','));
  }
  lines.push(`F&O Turnover,${report.fno.totalTurnover.toFixed(2)}`);
  lines.push(`F&O Net P&L,${report.fno.totalNetPnL.toFixed(2)}`);
  
  return lines.join('\n');
}

module.exports = {
  generateTaxReport,
  generateCapitalGainsSummary,
  generateFnOTurnoverReport,
  exportToCSV,
  getAvailableFYs,
  getCurrentFY,
  parseFYToDateRange
};
