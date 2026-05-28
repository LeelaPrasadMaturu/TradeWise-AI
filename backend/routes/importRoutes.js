const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const TradingRule = require('../models/TradingRule');
const auth = require('../middlewares/authMiddleware');
const { importFromCSV, validateCSV, SUPPORTED_BROKERS } = require('../services/csvImportService');
const { validateTrade, saveValidationResult } = require('../services/ruleValidationService');
const { generatePostTradeAnalysis } = require('../services/postTradeAnalysisService');

/**
 * @swagger
 * components:
 *   schemas:
 *     ImportResult:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         broker:
 *           type: string
 *         summary:
 *           type: object
 *           properties:
 *             totalExecutions:
 *               type: integer
 *             parsedExecutions:
 *               type: integer
 *             completedTrades:
 *               type: integer
 *             openPositions:
 *               type: integer
 *             imported:
 *               type: integer
 *             skipped:
 *               type: integer
 *         importedTrades:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Trade'
 */

/**
 * @swagger
 * /import/csv/validate:
 *   post:
 *     summary: Validate CSV before import (dry run)
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - csv
 *             properties:
 *               csv:
 *                 type: string
 *                 description: Raw CSV content
 *               broker:
 *                 type: string
 *                 enum: [auto, zerodha, generic]
 *                 default: auto
 *     responses:
 *       200:
 *         description: Validation result with preview
 *       400:
 *         description: Invalid CSV format
 */
router.post('/csv/validate', auth, async (req, res) => {
  try {
    const { csv, broker = 'auto' } = req.body;

    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'CSV content is required as a string'
      });
    }

    const validation = validateCSV(csv);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    res.json({
      success: true,
      message: 'CSV is valid and ready for import',
      ...validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating CSV',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /import/csv:
 *   post:
 *     summary: Import trades from broker CSV
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - csv
 *             properties:
 *               csv:
 *                 type: string
 *                 description: Raw CSV content from broker export
 *               broker:
 *                 type: string
 *                 enum: [auto, zerodha, generic]
 *                 default: auto
 *                 description: Broker format (auto-detect if not specified)
 *               includeOpen:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to import open positions
 *               skipDuplicates:
 *                 type: boolean
 *                 default: true
 *                 description: Skip trades that appear to be duplicates
 *     responses:
 *       200:
 *         description: Import completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImportResult'
 *       400:
 *         description: Invalid CSV or import error
 *       401:
 *         description: Authentication required
 */
router.post('/csv', auth, async (req, res) => {
  try {
    const { 
      csv, 
      broker = 'auto', 
      includeOpen = true,
      skipDuplicates = true 
    } = req.body;

    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'CSV content is required as a string'
      });
    }

    // Parse CSV
    const parseResult = importFromCSV(csv, { broker });
    
    // Combine trades to import
    let tradesToImport = [...parseResult.trades];
    if (includeOpen) {
      tradesToImport = [...tradesToImport, ...parseResult.openPositions];
    }

    if (tradesToImport.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No trades found in CSV to import',
        summary: parseResult.summary
      });
    }

    // Check for duplicates if enabled
    const importedTrades = [];
    const skippedTrades = [];
    
    // Check if user has any enabled rules
    const hasRules = await TradingRule.countDocuments({ user: req.user._id, enabled: true }) > 0;

    for (const trade of tradesToImport) {
      let isDuplicate = false;

      if (skipDuplicates) {
        // Check if similar trade already exists
        const existingTrade = await Trade.findOne({
          user: req.user._id,
          symbol: trade.symbol,
          entryPrice: trade.entryPrice,
          quantity: trade.quantity,
          tradeDate: {
            $gte: new Date(trade.tradeDate.getTime() - 86400000), // Within 1 day
            $lte: new Date(trade.tradeDate.getTime() + 86400000)
          }
        });

        if (existingTrade) {
          isDuplicate = true;
          skippedTrades.push({
            ...trade,
            reason: 'Duplicate trade found'
          });
        }
      }

      if (!isDuplicate) {
        // Create the trade
        const newTrade = new Trade({
          user: req.user._id,
          symbol: trade.symbol,
          assetType: trade.assetType || 'stock',
          segment: trade.segment || 'equity',
          instrumentType: trade.instrumentType || 'stock',
          optionType: trade.optionType || undefined,
          strikePrice: trade.strikePrice || undefined,
          contractExpiry: trade.contractExpiry || undefined,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice || undefined,
          entryTime: trade.entryTime || trade.tradeDate,
          exitTime: trade.exitTime || trade.exitDate || undefined,
          quantity: trade.quantity,
          direction: trade.direction,
          profitLoss: trade.profitLoss || undefined,
          result: trade.result || 'open',
          tradeDate: trade.tradeDate,
          exitDate: trade.exitDate || undefined,
          notes: trade.notes || `Imported from ${parseResult.broker} CSV`,
          tags: ['csv-import', parseResult.broker],
          source: 'csv_import'
        });

        await newTrade.save();
        
        // Run rule validation (same as manual trade creation)
        if (hasRules) {
          try {
            const validation = await validateTrade(req.user._id, {
              symbol: trade.symbol,
              entryPrice: trade.entryPrice,
              quantity: trade.quantity,
              direction: trade.direction,
              tradeDate: trade.tradeDate,
              entryTime: trade.entryTime || trade.tradeDate
            }, {
              checklistResponses: [],
              preTradeEmotion: null
            });
            
            // Save rule check and link to trade (don't block - it's historical)
            const ruleCheck = await saveValidationResult(
              req.user._id,
              validation,
              trade,
              newTrade._id
            );
            newTrade.ruleCheck = ruleCheck._id;
            await newTrade.save();
          } catch (ruleError) {
            console.error('Rule validation error for imported trade:', ruleError.message);
          }
        }
        
        // Run post-trade analysis for closed trades
        if (newTrade.result && newTrade.result !== 'open' && newTrade.exitPrice) {
          try {
            await generatePostTradeAnalysis(newTrade._id, req.user._id);
          } catch (analysisError) {
            console.error('Post-trade analysis error:', analysisError.message);
          }
        }
        
        importedTrades.push(newTrade);
      }
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedTrades.length} trades`,
      broker: parseResult.broker,
      summary: {
        ...parseResult.summary,
        imported: importedTrades.length,
        skipped: skippedTrades.length
      },
      importedTrades,
      skippedTrades: skippedTrades.length > 0 ? skippedTrades : undefined
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error importing CSV',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /import/supported-brokers:
 *   get:
 *     summary: Get list of supported broker formats
 *     tags: [Import]
 *     responses:
 *       200:
 *         description: List of supported brokers and their expected formats
 */
router.get('/supported-brokers', (req, res) => {
  res.json({
    brokers: [
      {
        id: 'zerodha',
        name: 'Zerodha',
        description: 'Zerodha Kite Tradebook CSV export',
        expectedColumns: ['trade_date', 'symbol/tradingsymbol', 'trade_type', 'quantity', 'price'],
        downloadInstructions: [
          '1. Login to console.zerodha.com',
          '2. Go to Reports > Tradebook',
          '3. Select date range and segment',
          '4. Click Download CSV'
        ]
      },
      {
        id: 'generic',
        name: 'Generic CSV',
        description: 'Any CSV with basic trade columns',
        expectedColumns: ['date', 'symbol', 'type (buy/sell)', 'quantity', 'price'],
        downloadInstructions: [
          'Export trades from your broker',
          'Ensure CSV has columns for: date, symbol, buy/sell, quantity, price'
        ]
      }
    ],
    sampleCsvUrl: '/api/import/sample-csv'
  });
});

/**
 * @swagger
 * /import/sample-csv:
 *   get:
 *     summary: Download sample CSV template
 *     tags: [Import]
 *     parameters:
 *       - in: query
 *         name: broker
 *         schema:
 *           type: string
 *           enum: [zerodha, generic]
 *           default: zerodha
 *     responses:
 *       200:
 *         description: Sample CSV content
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/sample-csv', (req, res) => {
  const { broker = 'zerodha' } = req.query;

  const zerodhaCSV = `trade_date,exchange,symbol,trade_type,quantity,price,order_id,trade_id
2024-03-15,NSE,RELIANCE,buy,10,2450.50,240315001,T240315001
2024-03-15,NSE,RELIANCE,sell,10,2485.75,240315002,T240315002
2024-03-16,NSE,TCS,buy,5,3850.00,240316001,T240316001
2024-03-18,NSE,TCS,sell,5,3920.25,240318001,T240318001
2024-03-18,NSE,INFY,buy,20,1580.00,240318002,T240318002
2024-03-19,NSE,INFY,sell,20,1545.50,240319001,T240319001
2024-03-20,NSE,HDFCBANK,buy,15,1520.00,240320001,T240320001
2024-03-20,BSE,TATAMOTORS,buy,25,980.50,240320002,T240320002
2024-03-21,BSE,TATAMOTORS,sell,25,1015.75,240321001,T240321001`;

  const genericCSV = `date,symbol,type,quantity,price
2024-03-15,RELIANCE,buy,10,2450.50
2024-03-15,RELIANCE,sell,10,2485.75
2024-03-16,TCS,buy,5,3850.00
2024-03-18,TCS,sell,5,3920.25
2024-03-18,INFY,buy,20,1580.00
2024-03-19,INFY,sell,20,1545.50
2024-03-20,HDFCBANK,buy,15,1520.00`;

  const csvContent = broker === 'zerodha' ? zerodhaCSV : genericCSV;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=sample_${broker}_tradebook.csv`);
  res.send(csvContent);
});

module.exports = router;
