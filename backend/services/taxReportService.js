/**
 * Tax Report Service
 * Generates ITR-ready tax reports for Indian traders
 * Updated with Budget 2024-25 tax rates
 * Supports: Equity (STCG/LTCG), Intraday, F&O turnover, capital gains summary
 */

const Trade = require('../models/Trade');

// ============================================
// INDIAN TAX CONSTANTS (FY 2024-25 onwards)
// ============================================

const TAX_CONSTANTS = {
  // Capital Gains Tax Rates (Budget 2024-25)
  STCG_RATE: 20,           // 20% for listed equity with STT paid (was 15%)
  LTCG_RATE: 12.5,         // 12.5% above exemption (was 10%)
  LTCG_EXEMPTION: 125000,  // Rs 1.25 lakh exemption (was Rs 1 lakh)
  
  // LTCG holding period: > 12 months for listed equity
  LTCG_HOLDING_DAYS: 365,
  
  // F&O Turnover thresholds for audit
  AUDIT_TURNOVER_DIGITAL: 100000000,  // Rs 10 crore for digital transactions
  AUDIT_TURNOVER_LOW_PROFIT: 20000000, // Rs 2 crore if profit < 6%
  AUDIT_MIN_PROFIT_PERCENT: 6,
  
  // Presumptive taxation threshold (Section 44AD)
  PRESUMPTIVE_TURNOVER_LIMIT: 30000000, // Rs 3 crore (if 95%+ digital receipts)
  PRESUMPTIVE_DIGITAL_PROFIT: 6,   // 6% deemed profit for digital
  PRESUMPTIVE_CASH_PROFIT: 8,      // 8% deemed profit for cash
  
  // Books of accounts threshold
  BOOKS_REQUIRED_TURNOVER: 2500000, // Rs 25 lakh
  
  // Basic exemption (New Tax Regime FY 2024-25)
  BASIC_EXEMPTION_NEW_REGIME: 300000,  // Rs 3 lakh
  BASIC_EXEMPTION_OLD_REGIME: 250000,  // Rs 2.5 lakh
  BASIC_EXEMPTION_SENIOR: 300000,      // Rs 3 lakh (60-80 years)
  BASIC_EXEMPTION_SUPER_SENIOR: 500000, // Rs 5 lakh (80+ years)
  
  // Tax slabs (New Regime FY 2024-25)
  TAX_SLABS_NEW: [
    { min: 0, max: 300000, rate: 0 },
    { min: 300000, max: 700000, rate: 5 },
    { min: 700000, max: 1000000, rate: 10 },
    { min: 1000000, max: 1200000, rate: 15 },
    { min: 1200000, max: 1500000, rate: 20 },
    { min: 1500000, max: Infinity, rate: 30 }
  ],
  
  // Carry forward limits
  CARRY_FORWARD_CAPITAL_LOSS: 8,    // 8 years
  CARRY_FORWARD_BUSINESS_LOSS: 8,   // 8 years  
  CARRY_FORWARD_SPECULATIVE_LOSS: 4 // 4 years
};

/**
 * Parse financial year string to date range
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
 */
function getCurrentFY() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${(year + 1).toString().slice(-2)}`;
}

/**
 * Get list of available financial years for a user
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
  
  return fys.reverse();
}

/**
 * Check if trade is intraday (same day buy/sell)
 */
function isIntradayTrade(trade) {
  const entryDate = new Date(trade.tradeDate || trade.entryTime);
  const exitDate = new Date(trade.exitDate || trade.exitTime || trade.tradeDate);
  
  return entryDate.toDateString() === exitDate.toDateString();
}

/**
 * Classify trade as STCG, LTCG, or Intraday
 */
function classifyCapitalGain(trade) {
  const entryDate = new Date(trade.tradeDate || trade.entryTime);
  const exitDate = new Date(trade.exitDate || trade.exitTime);
  
  if (!entryDate || !exitDate) return 'STCG';
  
  // Check if intraday first
  if (isIntradayTrade(trade)) {
    return 'INTRADAY'; // Speculative business income
  }
  
  const holdDays = Math.floor((exitDate - entryDate) / (1000 * 60 * 60 * 24));
  
  return holdDays > TAX_CONSTANTS.LTCG_HOLDING_DAYS ? 'LTCG' : 'STCG';
}

/**
 * Calculate tax liability for capital gains
 */
function calculateCapitalGainsTax(stcgAmount, ltcgAmount) {
  const taxes = {
    stcg: {
      taxableAmount: Math.max(0, stcgAmount),
      rate: TAX_CONSTANTS.STCG_RATE,
      tax: Math.max(0, stcgAmount) * (TAX_CONSTANTS.STCG_RATE / 100)
    },
    ltcg: {
      grossAmount: Math.max(0, ltcgAmount),
      exemption: TAX_CONSTANTS.LTCG_EXEMPTION,
      taxableAmount: Math.max(0, ltcgAmount - TAX_CONSTANTS.LTCG_EXEMPTION),
      rate: TAX_CONSTANTS.LTCG_RATE,
      tax: Math.max(0, ltcgAmount - TAX_CONSTANTS.LTCG_EXEMPTION) * (TAX_CONSTANTS.LTCG_RATE / 100)
    },
    totalTax: 0
  };
  
  taxes.totalTax = taxes.stcg.tax + taxes.ltcg.tax;
  
  return taxes;
}

/**
 * Calculate tax on business income based on slab rates
 */
function calculateSlabTax(income, regime = 'new') {
  const slabs = TAX_CONSTANTS.TAX_SLABS_NEW;
  let tax = 0;
  let remainingIncome = income;
  const breakdown = [];
  
  for (const slab of slabs) {
    if (remainingIncome <= 0) break;
    
    const taxableInSlab = Math.min(remainingIncome, slab.max - slab.min);
    const taxForSlab = taxableInSlab * (slab.rate / 100);
    
    if (taxableInSlab > 0) {
      breakdown.push({
        range: `₹${slab.min.toLocaleString('en-IN')} - ₹${slab.max === Infinity ? '∞' : slab.max.toLocaleString('en-IN')}`,
        rate: `${slab.rate}%`,
        taxableAmount: taxableInSlab,
        tax: taxForSlab
      });
    }
    
    tax += taxForSlab;
    remainingIncome -= (slab.max - slab.min);
  }
  
  // Add 4% Health & Education Cess
  const cess = tax * 0.04;
  
  return {
    grossIncome: income,
    taxBeforeCess: tax,
    cess,
    totalTax: tax + cess,
    effectiveRate: income > 0 ? ((tax + cess) / income * 100).toFixed(2) : 0,
    breakdown
  };
}

/**
 * Generate comprehensive tax report for a financial year
 */
async function generateTaxReport(userId, financialYear) {
  const { start, end } = parseFYToDateRange(financialYear);
  
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

  const report = {
    financialYear,
    generatedAt: new Date(),
    dateRange: { start, end },
    taxRates: {
      stcg: `${TAX_CONSTANTS.STCG_RATE}%`,
      ltcg: `${TAX_CONSTANTS.LTCG_RATE}% (above ₹${TAX_CONSTANTS.LTCG_EXEMPTION.toLocaleString('en-IN')} exemption)`,
      intraday: 'As per income tax slab (speculative business)',
      fno: 'As per income tax slab (non-speculative business)'
    },
    
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
        losses: 0,
        exemption: TAX_CONSTANTS.LTCG_EXEMPTION
      },
      intraday: {
        trades: [],
        totalPnL: 0,
        totalCharges: 0,
        netPnL: 0,
        turnover: 0,
        tradeCount: 0,
        wins: 0,
        losses: 0,
        nature: 'Speculative Business Income'
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
        tradeCount: 0,
        premiumReceived: 0,
        premiumPaid: 0
      },
      totalTurnover: 0,
      totalNetPnL: 0,
      totalCharges: 0,
      tradeCount: 0,
      nature: 'Non-Speculative Business Income'
    },
    
    summary: {
      totalPnL: 0,
      totalCharges: 0,
      netPnL: 0,
      totalTradeCount: 0,
      equityDeliveryCount: 0,
      equityIntradayCount: 0,
      fnoTradeCount: 0
    },
    
    taxLiability: {},
    
    lossSetOff: {
      stcgLoss: 0,
      ltcgLoss: 0,
      intradayLoss: 0,
      fnoLoss: 0,
      notes: []
    },
    
    compliance: {
      auditRequired: false,
      auditReason: null,
      booksRequired: false,
      itrForm: 'ITR-2',
      notes: []
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
    
    const segment = trade.segment || 'equity';
    const instrumentType = trade.instrumentType || 'stock';
    
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
      exchange: trade.exchange || trade.brokerData?.exchange || 'NSE',
      segment,
      instrumentType,
      optionType: trade.optionType,
      strikePrice: trade.strikePrice,
      isinCode: trade.isinCode || ''
    };
    
    if (segment === 'fno') {
      // F&O trades - non-speculative business income
      const fnoCategory = instrumentType === 'options' ? 'options' : 'futures';
      
      // Options turnover = premium received + premium paid (absolute)
      // Futures turnover = absolute P&L
      let turnover = Math.abs(pnl);
      if (instrumentType === 'options') {
        if (trade.direction === 'short' || trade.direction === 'sell') {
          report.fno.options.premiumReceived += trade.entryPrice * trade.quantity;
        } else {
          report.fno.options.premiumPaid += trade.entryPrice * trade.quantity;
        }
      }
      
      report.fno[fnoCategory].trades.push(tradeSummary);
      report.fno[fnoCategory].turnover += turnover;
      report.fno[fnoCategory].netPnL += pnl;
      report.fno[fnoCategory].totalCharges += charges;
      report.fno[fnoCategory].tradeCount++;
      
      report.fno.totalTurnover += turnover;
      report.fno.totalNetPnL += pnl;
      report.fno.totalCharges += charges;
      report.fno.tradeCount++;
      
      report.summary.fnoTradeCount++;
      
    } else {
      // Equity trades
      const gainType = classifyCapitalGain(trade);
      
      if (gainType === 'INTRADAY') {
        // Intraday - speculative business income
        tradeSummary.gainType = 'INTRADAY';
        report.equity.intraday.trades.push(tradeSummary);
        report.equity.intraday.totalPnL += pnl;
        report.equity.intraday.totalCharges += charges;
        report.equity.intraday.netPnL += netPnl;
        report.equity.intraday.turnover += Math.abs(pnl);
        report.equity.intraday.tradeCount++;
        if (isWin) report.equity.intraday.wins++;
        else if (pnl < 0) report.equity.intraday.losses++;
        
        report.summary.equityIntradayCount++;
      } else {
        // Delivery - capital gains
        const category = gainType.toLowerCase();
        tradeSummary.gainType = gainType;
        
        report.equity[category].trades.push(tradeSummary);
        report.equity[category].totalPnL += pnl;
        report.equity[category].totalCharges += charges;
        report.equity[category].netPnL += netPnl;
        report.equity[category].tradeCount++;
        if (isWin) report.equity[category].wins++;
        else if (pnl < 0) report.equity[category].losses++;
        
        report.summary.equityDeliveryCount++;
      }
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
      report.bySymbol[symbolKey] = { pnl: 0, charges: 0, trades: 0, segment, instrumentType };
    }
    report.bySymbol[symbolKey].pnl += pnl;
    report.bySymbol[symbolKey].charges += charges;
    report.bySymbol[symbolKey].trades++;
  }
  
  // Calculate tax liability
  report.taxLiability = calculateTaxLiability(report);
  
  // Handle loss set-off rules
  report.lossSetOff = calculateLossSetOff(report);
  
  // Determine compliance requirements
  report.compliance = determineCompliance(report);
  
  // Sort byMonth
  report.byMonth = Object.fromEntries(
    Object.entries(report.byMonth).sort(([a], [b]) => a.localeCompare(b))
  );
  
  // Top symbols
  report.topSymbols = Object.entries(report.bySymbol)
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 20);

  return report;
}

/**
 * Calculate overall tax liability
 */
function calculateTaxLiability(report) {
  const capitalGainsTax = calculateCapitalGainsTax(
    report.equity.stcg.netPnL,
    report.equity.ltcg.netPnL
  );
  
  // Business income = F&O (non-speculative) + Intraday (speculative)
  const businessIncome = report.fno.totalNetPnL + report.equity.intraday.netPnL;
  const businessTax = businessIncome > 0 ? calculateSlabTax(businessIncome) : null;
  
  return {
    capitalGains: capitalGainsTax,
    businessIncome: {
      fnoIncome: report.fno.totalNetPnL,
      intradayIncome: report.equity.intraday.netPnL,
      totalBusinessIncome: businessIncome,
      taxCalculation: businessTax,
      note: 'Business income is added to other income and taxed at slab rates'
    },
    estimatedTotalTax: capitalGainsTax.totalTax + (businessTax?.totalTax || 0),
    disclaimer: 'This is an estimate. Consult a CA for accurate tax computation considering all income sources, deductions, and exemptions.'
  };
}

/**
 * Calculate loss set-off and carry forward
 */
function calculateLossSetOff(report) {
  const result = {
    stcgLoss: Math.min(0, report.equity.stcg.netPnL),
    ltcgLoss: Math.min(0, report.equity.ltcg.netPnL),
    intradayLoss: Math.min(0, report.equity.intraday.netPnL),
    fnoLoss: Math.min(0, report.fno.totalNetPnL),
    setOffApplied: [],
    carryForward: [],
    notes: []
  };
  
  // STCG loss can be set off against STCG and LTCG
  if (result.stcgLoss < 0 && report.equity.ltcg.netPnL > 0) {
    const setOff = Math.min(Math.abs(result.stcgLoss), report.equity.ltcg.netPnL);
    result.setOffApplied.push({
      from: 'STCG Loss',
      against: 'LTCG Gain',
      amount: setOff
    });
  }
  
  // LTCG loss can only be set off against LTCG
  if (result.ltcgLoss < 0) {
    result.notes.push('LTCG loss can only be set off against LTCG gains');
    result.carryForward.push({
      type: 'LTCG Loss',
      amount: Math.abs(result.ltcgLoss),
      carryForwardYears: TAX_CONSTANTS.CARRY_FORWARD_CAPITAL_LOSS
    });
  }
  
  // Speculative (intraday) loss can only be set off against speculative income
  if (result.intradayLoss < 0) {
    result.notes.push('Intraday (speculative) loss can only be set off against speculative income');
    result.carryForward.push({
      type: 'Speculative Loss',
      amount: Math.abs(result.intradayLoss),
      carryForwardYears: TAX_CONSTANTS.CARRY_FORWARD_SPECULATIVE_LOSS
    });
  }
  
  // F&O loss can be set off against any income except salary
  if (result.fnoLoss < 0) {
    result.notes.push('F&O (non-speculative business) loss can be set off against any income except salary');
    result.carryForward.push({
      type: 'Business Loss (F&O)',
      amount: Math.abs(result.fnoLoss),
      carryForwardYears: TAX_CONSTANTS.CARRY_FORWARD_BUSINESS_LOSS
    });
  }
  
  return result;
}

/**
 * Determine compliance requirements
 */
function determineCompliance(report) {
  const compliance = {
    auditRequired: false,
    auditReason: null,
    booksRequired: false,
    booksReason: null,
    itrForm: 'ITR-2',
    gstRequired: false,
    notes: []
  };
  
  const totalTurnover = report.fno.totalTurnover + report.equity.intraday.turnover;
  const totalBusinessPnL = report.fno.totalNetPnL + report.equity.intraday.netPnL;
  const profitPercent = totalTurnover > 0 ? (totalBusinessPnL / totalTurnover) * 100 : 0;
  
  // Determine ITR form
  if (report.fno.tradeCount > 0 || report.equity.intraday.tradeCount > 0) {
    compliance.itrForm = 'ITR-3'; // Business income requires ITR-3
    compliance.notes.push('ITR-3 is required as you have F&O or intraday trading (business income)');
  } else if (report.equity.stcg.tradeCount > 0 || report.equity.ltcg.tradeCount > 0) {
    compliance.itrForm = 'ITR-2'; // Capital gains require ITR-2
    compliance.notes.push('ITR-2 is required for capital gains from equity delivery trades');
  }
  
  // Tax audit check
  if (totalTurnover > TAX_CONSTANTS.AUDIT_TURNOVER_DIGITAL) {
    compliance.auditRequired = true;
    compliance.auditReason = `Turnover (₹${(totalTurnover / 10000000).toFixed(2)} Cr) exceeds ₹10 crore threshold`;
  } else if (totalTurnover > TAX_CONSTANTS.AUDIT_TURNOVER_LOW_PROFIT && profitPercent < TAX_CONSTANTS.AUDIT_MIN_PROFIT_PERCENT) {
    compliance.auditRequired = true;
    compliance.auditReason = `Turnover exceeds ₹2 crore and profit (${profitPercent.toFixed(2)}%) is less than 6%`;
  }
  
  // Books of accounts
  if (totalTurnover > TAX_CONSTANTS.BOOKS_REQUIRED_TURNOVER) {
    compliance.booksRequired = true;
    compliance.booksReason = `Turnover exceeds ₹25 lakh - maintain books of accounts`;
    compliance.notes.push('Maintain proper books of accounts as turnover exceeds ₹25 lakh');
  }
  
  // Presumptive taxation eligibility (Section 44AD)
  if (totalTurnover <= TAX_CONSTANTS.PRESUMPTIVE_TURNOVER_LIMIT && totalTurnover > 0) {
    const deemedProfit = totalTurnover * (TAX_CONSTANTS.PRESUMPTIVE_DIGITAL_PROFIT / 100);
    if (totalBusinessPnL < deemedProfit) {
      compliance.notes.push(`You may opt for presumptive taxation (44AD). Deemed profit: ₹${deemedProfit.toFixed(2)} (6% of turnover)`);
    }
  }
  
  // Advance tax reminder
  if (report.taxLiability?.estimatedTotalTax > 10000) {
    compliance.notes.push('If total tax liability exceeds ₹10,000, pay advance tax in quarterly installments');
  }
  
  return compliance;
}

/**
 * Generate capital gains summary for ITR filing
 */
async function generateCapitalGainsSummary(userId, financialYear) {
  const report = await generateTaxReport(userId, financialYear);
  
  const stcgTaxable = Math.max(0, report.equity.stcg.netPnL);
  const ltcgTaxable = Math.max(0, report.equity.ltcg.netPnL - TAX_CONSTANTS.LTCG_EXEMPTION);
  
  return {
    financialYear,
    generatedAt: new Date(),
    assessmentYear: `${parseInt(financialYear.split('-')[0]) + 1}-${parseInt(financialYear.split('-')[1]) + 1}`,
    
    shortTermCapitalGains: {
      section: '111A',
      description: 'Listed equity shares (STT paid)',
      totalGains: Math.max(0, report.equity.stcg.netPnL),
      totalLosses: Math.abs(Math.min(0, report.equity.stcg.netPnL)),
      netGainLoss: report.equity.stcg.netPnL,
      taxableAmount: stcgTaxable,
      taxRate: `${TAX_CONSTANTS.STCG_RATE}%`,
      estimatedTax: stcgTaxable * (TAX_CONSTANTS.STCG_RATE / 100),
      tradeCount: report.equity.stcg.tradeCount
    },
    
    longTermCapitalGains: {
      section: '112A',
      description: 'Listed equity shares (STT paid)',
      totalGains: Math.max(0, report.equity.ltcg.netPnL),
      totalLosses: Math.abs(Math.min(0, report.equity.ltcg.netPnL)),
      netGainLoss: report.equity.ltcg.netPnL,
      exemption: TAX_CONSTANTS.LTCG_EXEMPTION,
      taxableAmount: ltcgTaxable,
      taxRate: `${TAX_CONSTANTS.LTCG_RATE}%`,
      estimatedTax: ltcgTaxable * (TAX_CONSTANTS.LTCG_RATE / 100),
      tradeCount: report.equity.ltcg.tradeCount,
      note: `Exemption of ₹${TAX_CONSTANTS.LTCG_EXEMPTION.toLocaleString('en-IN')} available`
    },
    
    summary: {
      totalSTCG: report.equity.stcg.netPnL,
      totalLTCG: report.equity.ltcg.netPnL,
      totalCapitalGains: report.equity.stcg.netPnL + report.equity.ltcg.netPnL,
      totalTaxableGains: stcgTaxable + ltcgTaxable,
      estimatedTax: (stcgTaxable * TAX_CONSTANTS.STCG_RATE / 100) + (ltcgTaxable * TAX_CONSTANTS.LTCG_RATE / 100)
    },
    
    lossCarryForward: {
      stcgLoss: Math.abs(Math.min(0, report.equity.stcg.netPnL)),
      ltcgLoss: Math.abs(Math.min(0, report.equity.ltcg.netPnL)),
      carryForwardYears: TAX_CONSTANTS.CARRY_FORWARD_CAPITAL_LOSS
    }
  };
}

/**
 * Generate F&O turnover report for ITR business income
 */
async function generateFnOTurnoverReport(userId, financialYear) {
  const report = await generateTaxReport(userId, financialYear);
  
  const totalTurnover = report.fno.totalTurnover + report.equity.intraday.turnover;
  const totalPnL = report.fno.totalNetPnL + report.equity.intraday.netPnL;
  const profitPercent = totalTurnover > 0 ? (totalPnL / totalTurnover) * 100 : 0;
  
  return {
    financialYear,
    generatedAt: new Date(),
    assessmentYear: `${parseInt(financialYear.split('-')[0]) + 1}-${parseInt(financialYear.split('-')[1]) + 1}`,
    
    turnoverCalculation: {
      futures: {
        description: 'Absolute sum of profits and losses',
        turnover: report.fno.futures.turnover,
        netPnL: report.fno.futures.netPnL,
        trades: report.fno.futures.tradeCount
      },
      options: {
        description: 'Absolute sum of profits and losses + premium received',
        turnover: report.fno.options.turnover,
        premiumReceived: report.fno.options.premiumReceived,
        premiumPaid: report.fno.options.premiumPaid,
        netPnL: report.fno.options.netPnL,
        trades: report.fno.options.tradeCount
      },
      intraday: {
        description: 'Speculative business - absolute sum of profits and losses',
        turnover: report.equity.intraday.turnover,
        netPnL: report.equity.intraday.netPnL,
        trades: report.equity.intraday.tradeCount
      },
      totalTurnover: totalTurnover,
      totalNetPnL: totalPnL
    },
    
    profitAndLoss: {
      grossPnL: totalPnL + report.fno.totalCharges + report.equity.intraday.totalCharges,
      charges: report.fno.totalCharges + report.equity.intraday.totalCharges,
      netPnL: totalPnL,
      profitPercentage: profitPercent.toFixed(2),
      deemedProfit6Percent: totalTurnover * 0.06
    },
    
    incomeClassification: {
      fno: {
        type: 'Non-speculative business income',
        amount: report.fno.totalNetPnL,
        section: 'Section 43(5)',
        note: 'Taxed at slab rates'
      },
      intraday: {
        type: 'Speculative business income',
        amount: report.equity.intraday.netPnL,
        section: 'Section 43(5)',
        note: 'Speculative loss can only be set off against speculative income'
      }
    },
    
    taxAudit: report.compliance,
    
    presumptiveTaxation: {
      eligible: totalTurnover <= TAX_CONSTANTS.PRESUMPTIVE_TURNOVER_LIMIT,
      section: '44AD',
      deemedProfitRate: '6% (digital transactions)',
      deemedProfit: totalTurnover * 0.06,
      note: totalTurnover <= TAX_CONSTANTS.PRESUMPTIVE_TURNOVER_LIMIT 
        ? 'You may opt for presumptive taxation if deemed profit is acceptable'
        : 'Not eligible - turnover exceeds ₹3 crore'
    },
    
    itrForm: report.compliance.itrForm,
    
    schedules: {
      bp: 'Schedule BP (Business/Profession income)',
      cg: report.equity.stcg.tradeCount > 0 || report.equity.ltcg.tradeCount > 0 ? 'Schedule CG (Capital Gains)' : null,
      os: 'Schedule OS if other speculative income exists'
    }
  };
}

/**
 * Export to ITR-2/ITR-3 compatible format (Schedule CG)
 */
function exportToITRFormat(report) {
  const itrData = {
    header: {
      assessmentYear: `${parseInt(report.financialYear.split('-')[0]) + 1}-${parseInt(report.financialYear.split('-')[1]) + 1}`,
      financialYear: report.financialYear,
      generatedBy: 'TradeWise AI',
      generatedAt: new Date().toISOString()
    },
    
    scheduleCG: {
      shortTermCapitalGains: {
        section111A: {
          description: 'From sale of equity shares/units of equity oriented MF on which STT is paid',
          fullValueOfConsideration: report.equity.stcg.trades.reduce((sum, t) => sum + (t.exitPrice * t.quantity), 0),
          costOfAcquisition: report.equity.stcg.trades.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0),
          expenditureOnTransfer: report.equity.stcg.totalCharges,
          totalSTCG: report.equity.stcg.netPnL,
          deductions: 0,
          taxableSTCG: Math.max(0, report.equity.stcg.netPnL)
        }
      },
      longTermCapitalGains: {
        section112A: {
          description: 'From sale of equity shares/units on which STT is paid',
          fullValueOfConsideration: report.equity.ltcg.trades.reduce((sum, t) => sum + (t.exitPrice * t.quantity), 0),
          costOfAcquisition: report.equity.ltcg.trades.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0),
          expenditureOnTransfer: report.equity.ltcg.totalCharges,
          totalLTCG: report.equity.ltcg.netPnL,
          exemptionUnder112A: TAX_CONSTANTS.LTCG_EXEMPTION,
          taxableLTCG: Math.max(0, report.equity.ltcg.netPnL - TAX_CONSTANTS.LTCG_EXEMPTION)
        }
      },
      lossSetOff: report.lossSetOff,
      lossBroughtForward: {
        note: 'Enter losses brought forward from previous years here'
      }
    },
    
    scheduleBP: (report.fno.tradeCount > 0 || report.equity.intraday.tradeCount > 0) ? {
      nonSpeculativeIncome: {
        description: 'F&O Trading',
        grossReceipts: report.fno.totalTurnover,
        netProfit: report.fno.totalNetPnL
      },
      speculativeIncome: {
        description: 'Intraday Equity Trading',
        grossReceipts: report.equity.intraday.turnover,
        netProfit: report.equity.intraday.netPnL
      },
      totalBusinessIncome: report.fno.totalNetPnL + report.equity.intraday.netPnL
    } : null,
    
    tradeWiseSummary: report.equity.stcg.trades.concat(report.equity.ltcg.trades).map(t => ({
      isinCode: t.isinCode || '',
      nameOfScrip: t.symbol,
      numberOfShares: t.quantity,
      saleDate: new Date(t.exitDate).toISOString().split('T')[0],
      salePrice: t.exitPrice,
      saleValue: t.exitPrice * t.quantity,
      purchaseDate: new Date(t.entryDate).toISOString().split('T')[0],
      purchasePrice: t.entryPrice,
      purchaseValue: t.entryPrice * t.quantity,
      expenditure: t.charges,
      capitalGain: t.netPnl,
      type: t.gainType
    }))
  };
  
  return itrData;
}

/**
 * Export tax report to CSV format (for manual verification)
 */
function exportToCSV(report) {
  const lines = [];
  
  // Header
  lines.push('TradeWise AI - Tax Report (Indian Tax Rules FY 2024-25 onwards)');
  lines.push(`Financial Year: ${report.financialYear}`);
  lines.push(`Assessment Year: ${parseInt(report.financialYear.split('-')[0]) + 1}-${parseInt(report.financialYear.split('-')[1]) + 1}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleDateString('en-IN')}`);
  lines.push('');
  
  // Tax Rates Reference
  lines.push('=== APPLICABLE TAX RATES ===');
  lines.push(`STCG (Section 111A): ${TAX_CONSTANTS.STCG_RATE}%`);
  lines.push(`LTCG (Section 112A): ${TAX_CONSTANTS.LTCG_RATE}% above Rs ${TAX_CONSTANTS.LTCG_EXEMPTION.toLocaleString('en-IN')} exemption`);
  lines.push('Intraday: Speculative business income - taxed at slab rates');
  lines.push('F&O: Non-speculative business income - taxed at slab rates');
  lines.push('');
  
  // Summary
  lines.push('=== SUMMARY ===');
  lines.push(`Total P&L,${report.summary.totalPnL.toFixed(2)}`);
  lines.push(`Total Charges,${report.summary.totalCharges.toFixed(2)}`);
  lines.push(`Net P&L,${report.summary.netPnL.toFixed(2)}`);
  lines.push(`Total Trades,${report.summary.totalTradeCount}`);
  lines.push(`ITR Form Required,${report.compliance.itrForm}`);
  lines.push(`Tax Audit Required,${report.compliance.auditRequired ? 'YES - ' + report.compliance.auditReason : 'NO'}`);
  lines.push('');
  
  // STCG
  lines.push('=== EQUITY - SHORT TERM CAPITAL GAINS (Section 111A) ===');
  lines.push(`Tax Rate: ${TAX_CONSTANTS.STCG_RATE}%`);
  lines.push('ISIN,Symbol,Direction,Entry Date,Exit Date,Entry Price,Exit Price,Quantity,Sale Value,Purchase Value,Charges,Net P&L');
  for (const trade of report.equity.stcg.trades) {
    lines.push([
      trade.isinCode || '',
      trade.symbol,
      trade.direction,
      new Date(trade.entryDate).toLocaleDateString('en-IN'),
      new Date(trade.exitDate).toLocaleDateString('en-IN'),
      trade.entryPrice.toFixed(2),
      trade.exitPrice.toFixed(2),
      trade.quantity,
      (trade.exitPrice * trade.quantity).toFixed(2),
      (trade.entryPrice * trade.quantity).toFixed(2),
      trade.charges.toFixed(2),
      trade.netPnl.toFixed(2)
    ].join(','));
  }
  lines.push(`STCG Subtotal,,,,,,,,,${report.equity.stcg.totalCharges.toFixed(2)},${report.equity.stcg.netPnL.toFixed(2)}`);
  lines.push(`Estimated Tax (${TAX_CONSTANTS.STCG_RATE}%),${(Math.max(0, report.equity.stcg.netPnL) * TAX_CONSTANTS.STCG_RATE / 100).toFixed(2)}`);
  lines.push('');
  
  // LTCG
  lines.push('=== EQUITY - LONG TERM CAPITAL GAINS (Section 112A) ===');
  lines.push(`Tax Rate: ${TAX_CONSTANTS.LTCG_RATE}% (above Rs ${TAX_CONSTANTS.LTCG_EXEMPTION.toLocaleString('en-IN')} exemption)`);
  lines.push('ISIN,Symbol,Direction,Entry Date,Exit Date,Entry Price,Exit Price,Quantity,Sale Value,Purchase Value,Charges,Net P&L');
  for (const trade of report.equity.ltcg.trades) {
    lines.push([
      trade.isinCode || '',
      trade.symbol,
      trade.direction,
      new Date(trade.entryDate).toLocaleDateString('en-IN'),
      new Date(trade.exitDate).toLocaleDateString('en-IN'),
      trade.entryPrice.toFixed(2),
      trade.exitPrice.toFixed(2),
      trade.quantity,
      (trade.exitPrice * trade.quantity).toFixed(2),
      (trade.entryPrice * trade.quantity).toFixed(2),
      trade.charges.toFixed(2),
      trade.netPnl.toFixed(2)
    ].join(','));
  }
  lines.push(`LTCG Subtotal,,,,,,,,,${report.equity.ltcg.totalCharges.toFixed(2)},${report.equity.ltcg.netPnL.toFixed(2)}`);
  lines.push(`Exemption,${TAX_CONSTANTS.LTCG_EXEMPTION}`);
  lines.push(`Taxable LTCG,${Math.max(0, report.equity.ltcg.netPnL - TAX_CONSTANTS.LTCG_EXEMPTION).toFixed(2)}`);
  lines.push(`Estimated Tax (${TAX_CONSTANTS.LTCG_RATE}%),${(Math.max(0, report.equity.ltcg.netPnL - TAX_CONSTANTS.LTCG_EXEMPTION) * TAX_CONSTANTS.LTCG_RATE / 100).toFixed(2)}`);
  lines.push('');
  
  // Intraday
  if (report.equity.intraday.tradeCount > 0) {
    lines.push('=== EQUITY INTRADAY - SPECULATIVE BUSINESS INCOME ===');
    lines.push('Symbol,Direction,Date,Entry Price,Exit Price,Quantity,P&L,Charges,Net P&L');
    for (const trade of report.equity.intraday.trades) {
      lines.push([
        trade.symbol,
        trade.direction,
        new Date(trade.entryDate).toLocaleDateString('en-IN'),
        trade.entryPrice.toFixed(2),
        trade.exitPrice.toFixed(2),
        trade.quantity,
        trade.pnl.toFixed(2),
        trade.charges.toFixed(2),
        trade.netPnl.toFixed(2)
      ].join(','));
    }
    lines.push(`Intraday Subtotal,,,,,,${report.equity.intraday.totalPnL.toFixed(2)},${report.equity.intraday.totalCharges.toFixed(2)},${report.equity.intraday.netPnL.toFixed(2)}`);
    lines.push(`Turnover (for audit purposes),${report.equity.intraday.turnover.toFixed(2)}`);
    lines.push('Note: Speculative loss can only be set off against speculative income. Carry forward: 4 years');
    lines.push('');
  }
  
  // F&O
  if (report.fno.tradeCount > 0) {
    lines.push('=== F&O - NON-SPECULATIVE BUSINESS INCOME ===');
    lines.push('Symbol,Type,Option Type,Direction,Entry Date,Exit Date,Entry Price,Exit Price,Quantity,P&L,Charges');
    const allFnOTrades = [...report.fno.futures.trades, ...report.fno.options.trades];
    for (const trade of allFnOTrades) {
      lines.push([
        trade.symbol,
        trade.instrumentType,
        trade.optionType || '',
        trade.direction,
        new Date(trade.entryDate).toLocaleDateString('en-IN'),
        new Date(trade.exitDate).toLocaleDateString('en-IN'),
        trade.entryPrice.toFixed(2),
        trade.exitPrice.toFixed(2),
        trade.quantity,
        trade.pnl.toFixed(2),
        trade.charges.toFixed(2)
      ].join(','));
    }
    lines.push(`F&O Net P&L,${report.fno.totalNetPnL.toFixed(2)}`);
    lines.push(`F&O Turnover,${report.fno.totalTurnover.toFixed(2)}`);
    lines.push('Note: F&O loss can be set off against any income except salary. Carry forward: 8 years');
    lines.push('');
  }
  
  // Compliance
  lines.push('=== COMPLIANCE REQUIREMENTS ===');
  lines.push(`ITR Form,${report.compliance.itrForm}`);
  lines.push(`Tax Audit Required,${report.compliance.auditRequired ? 'YES' : 'NO'}`);
  if (report.compliance.auditReason) {
    lines.push(`Audit Reason,${report.compliance.auditReason}`);
  }
  lines.push(`Books of Accounts Required,${report.compliance.booksRequired ? 'YES' : 'NO'}`);
  for (const note of report.compliance.notes) {
    lines.push(`Note,${note}`);
  }
  
  return lines.join('\n');
}

/**
 * Export trade-wise details for ITR Schedule CG
 */
function exportScheduleCG(report) {
  const lines = [];
  
  lines.push('Schedule CG - Capital Gains (Compatible with ITR-2/ITR-3)');
  lines.push(`Financial Year: ${report.financialYear}`);
  lines.push('');
  
  // Section 111A - STCG
  lines.push('=== SCHEDULE CG - SECTION 111A (SHORT TERM CAPITAL GAINS) ===');
  lines.push('Sr No,ISIN Code,Name of Share/Unit,No. of Shares,Date of Sale (DD/MM/YYYY),Sale Price per Share,Total Sale Value,Date of Purchase (DD/MM/YYYY),Purchase Price per Share,Total Purchase Value,Expenses on Transfer,Capital Gain/Loss');
  
  let srNo = 1;
  for (const trade of report.equity.stcg.trades) {
    lines.push([
      srNo++,
      trade.isinCode || '',
      trade.symbol,
      trade.quantity,
      new Date(trade.exitDate).toLocaleDateString('en-IN'),
      trade.exitPrice.toFixed(2),
      (trade.exitPrice * trade.quantity).toFixed(2),
      new Date(trade.entryDate).toLocaleDateString('en-IN'),
      trade.entryPrice.toFixed(2),
      (trade.entryPrice * trade.quantity).toFixed(2),
      trade.charges.toFixed(2),
      trade.netPnl.toFixed(2)
    ].join(','));
  }
  lines.push(`Total STCG (Section 111A),${report.equity.stcg.netPnL.toFixed(2)}`);
  lines.push('');
  
  // Section 112A - LTCG
  lines.push('=== SCHEDULE CG - SECTION 112A (LONG TERM CAPITAL GAINS) ===');
  lines.push('Sr No,ISIN Code,Name of Share/Unit,No. of Shares,Date of Sale (DD/MM/YYYY),Sale Price per Share,Total Sale Value,Date of Purchase (DD/MM/YYYY),Purchase Price per Share,Total Purchase Value,Expenses on Transfer,Capital Gain/Loss');
  
  srNo = 1;
  for (const trade of report.equity.ltcg.trades) {
    lines.push([
      srNo++,
      trade.isinCode || '',
      trade.symbol,
      trade.quantity,
      new Date(trade.exitDate).toLocaleDateString('en-IN'),
      trade.exitPrice.toFixed(2),
      (trade.exitPrice * trade.quantity).toFixed(2),
      new Date(trade.entryDate).toLocaleDateString('en-IN'),
      trade.entryPrice.toFixed(2),
      (trade.entryPrice * trade.quantity).toFixed(2),
      trade.charges.toFixed(2),
      trade.netPnl.toFixed(2)
    ].join(','));
  }
  lines.push(`Total LTCG (before exemption),${report.equity.ltcg.netPnL.toFixed(2)}`);
  lines.push(`Exemption u/s 112A,${TAX_CONSTANTS.LTCG_EXEMPTION}`);
  lines.push(`Taxable LTCG,${Math.max(0, report.equity.ltcg.netPnL - TAX_CONSTANTS.LTCG_EXEMPTION).toFixed(2)}`);
  
  return lines.join('\n');
}

module.exports = {
  generateTaxReport,
  generateCapitalGainsSummary,
  generateFnOTurnoverReport,
  exportToCSV,
  exportToITRFormat,
  exportScheduleCG,
  getAvailableFYs,
  getCurrentFY,
  parseFYToDateRange,
  TAX_CONSTANTS
};
