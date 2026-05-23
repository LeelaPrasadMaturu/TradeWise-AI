/**
 * Report Routes
 * Tax reports, capital gains, and F&O turnover endpoints
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
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
 * Export tax report as CSV
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
    
    // For other formats, return JSON (PDF can be generated client-side)
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
