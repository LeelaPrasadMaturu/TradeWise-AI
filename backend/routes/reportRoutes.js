/**
 * Report Routes
 * Tax reports, capital gains, and F&O turnover endpoints
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const taxReportService = require('../services/taxReportService');

/**
 * GET /api/reports/tax
 * Generate tax report for a financial year
 */
router.get('/tax', auth, async (req, res) => {
  try {
    const { fy } = req.query;
    const financialYear = fy || taxReportService.getCurrentFY();
    
    const report = await taxReportService.generateTaxReport(
      req.user._id,
      financialYear
    );
    
    res.json(report);
  } catch (error) {
    console.error('Tax report generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate tax report',
      message: error.message 
    });
  }
});

/**
 * GET /api/reports/tax/export
 * Export tax report in various formats
 * Formats: csv (default), itr (ITR-compatible JSON), schedule-cg (ITR Schedule CG format)
 */
router.get('/tax/export', auth, async (req, res) => {
  try {
    const { fy, format = 'csv' } = req.query;
    const financialYear = fy || taxReportService.getCurrentFY();
    
    const report = await taxReportService.generateTaxReport(
      req.user._id,
      financialYear
    );
    
    if (format === 'csv') {
      const csv = taxReportService.exportToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tax-report-${financialYear}.csv"`);
      return res.send(csv);
    }
    
    if (format === 'itr') {
      // ITR-compatible JSON format
      const itrData = taxReportService.exportToITRFormat(report);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="itr-data-${financialYear}.json"`);
      return res.json(itrData);
    }
    
    if (format === 'schedule-cg') {
      // Schedule CG CSV for direct ITR upload
      const scheduleCG = taxReportService.exportScheduleCG(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="schedule-cg-${financialYear}.csv"`);
      return res.send(scheduleCG);
    }
    
    // Default: return full report as JSON
    res.json(report);
  } catch (error) {
    console.error('Tax report export error:', error);
    res.status(500).json({ 
      error: 'Failed to export tax report',
      message: error.message 
    });
  }
});

/**
 * GET /api/reports/tax-constants
 * Get current Indian tax rates and thresholds
 */
router.get('/tax-constants', auth, (req, res) => {
  res.json({
    rates: {
      stcg: {
        rate: taxReportService.TAX_CONSTANTS.STCG_RATE,
        description: 'Short Term Capital Gains on listed equity (Section 111A)',
        applicableWhen: 'Holding period <= 12 months'
      },
      ltcg: {
        rate: taxReportService.TAX_CONSTANTS.LTCG_RATE,
        exemption: taxReportService.TAX_CONSTANTS.LTCG_EXEMPTION,
        description: 'Long Term Capital Gains on listed equity (Section 112A)',
        applicableWhen: 'Holding period > 12 months'
      }
    },
    businessIncome: {
      fno: 'Non-speculative - taxed at slab rates, can set off against other income',
      intraday: 'Speculative - taxed at slab rates, can only set off against speculative income'
    },
    auditThresholds: {
      digitalTurnover: taxReportService.TAX_CONSTANTS.AUDIT_TURNOVER_DIGITAL,
      lowProfitTurnover: taxReportService.TAX_CONSTANTS.AUDIT_TURNOVER_LOW_PROFIT,
      minProfitPercent: taxReportService.TAX_CONSTANTS.AUDIT_MIN_PROFIT_PERCENT
    },
    carryForward: {
      capitalLoss: taxReportService.TAX_CONSTANTS.CARRY_FORWARD_CAPITAL_LOSS,
      businessLoss: taxReportService.TAX_CONSTANTS.CARRY_FORWARD_BUSINESS_LOSS,
      speculativeLoss: taxReportService.TAX_CONSTANTS.CARRY_FORWARD_SPECULATIVE_LOSS
    },
    source: 'Budget 2024-25 (applicable from FY 2024-25)'
  });
});

/**
 * GET /api/reports/capital-gains
 * Get capital gains summary for ITR filing
 */
router.get('/capital-gains', auth, async (req, res) => {
  try {
    const { fy } = req.query;
    const financialYear = fy || taxReportService.getCurrentFY();
    
    const summary = await taxReportService.generateCapitalGainsSummary(
      req.user._id,
      financialYear
    );
    
    res.json(summary);
  } catch (error) {
    console.error('Capital gains summary error:', error);
    res.status(500).json({ 
      error: 'Failed to generate capital gains summary',
      message: error.message 
    });
  }
});

/**
 * GET /api/reports/fno-turnover
 * Get F&O turnover report for business income
 */
router.get('/fno-turnover', auth, async (req, res) => {
  try {
    const { fy } = req.query;
    const financialYear = fy || taxReportService.getCurrentFY();
    
    const turnoverReport = await taxReportService.generateFnOTurnoverReport(
      req.user._id,
      financialYear
    );
    
    res.json(turnoverReport);
  } catch (error) {
    console.error('F&O turnover report error:', error);
    res.status(500).json({ 
      error: 'Failed to generate F&O turnover report',
      message: error.message 
    });
  }
});

/**
 * GET /api/reports/available-years
 * Get list of financial years with trade data
 */
router.get('/available-years', auth, async (req, res) => {
  try {
    const years = await taxReportService.getAvailableFYs(req.user._id);
    res.json({ years, current: taxReportService.getCurrentFY() });
  } catch (error) {
    console.error('Available years error:', error);
    res.status(500).json({ 
      error: 'Failed to get available years',
      message: error.message 
    });
  }
});

module.exports = router;
