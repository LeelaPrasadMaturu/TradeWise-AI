const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Alert:
 *       type: object
 *       required:
 *         - symbol
 *         - condition
 *         - price
 *       properties:
 *         symbol:
 *           type: string
 *           description: Trading symbol (e.g., BTC/USD)
 *         condition:
 *           type: string
 *           enum: [above, below, crosses]
 *           description: Alert condition
 *         price:
 *           type: number
 *           description: Target price
 *         description:
 *           type: string
 *           description: Alert description
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the alert is active
 *         notificationPreferences:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             push:
 *               type: boolean
 *             sms:
 *               type: boolean
 *     AlertStats:
 *       type: object
 *       properties:
 *         totalAlerts:
 *           type: integer
 *         activeAlerts:
 *           type: integer
 *         triggeredAlerts:
 *           type: integer
 *         bySymbol:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               symbol:
 *                 type: string
 *               count:
 *                 type: integer
 */

/**
 * @swagger
 * /alerts:
 *   post:
 *     summary: Create a new price alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Alert'
 *     responses:
 *       201:
 *         description: Alert created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       401:
 *         description: Authentication required
 */
router.post('/', alertController.createAlert);

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: Get all alerts for the authenticated user
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Alert'
 *       401:
 *         description: Authentication required
 */
router.get('/', alertController.getUserAlerts);

/**
 * @swagger
 * /alerts/{id}:
 *   put:
 *     summary: Update an alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Alert'
 *     responses:
 *       200:
 *         description: Alert updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Alert not found
 */
router.put('/:id', alertController.updateAlert);

/**
 * @swagger
 * /alerts/{id}:
 *   delete:
 *     summary: Delete an alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Alert not found
 */
router.delete('/:id', alertController.deleteAlert);

/**
 * @swagger
 * /alerts/stats:
 *   get:
 *     summary: Get alert statistics
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlertStats'
 *       401:
 *         description: Authentication required
 */
router.get('/stats', alertController.getAlertStats);

/**
 * @swagger
 * /alerts/monitor/start:
 *   post:
 *     summary: Start alert monitoring
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert monitoring started successfully
 *       401:
 *         description: Authentication required
 */
router.post('/monitor/start', alertController.startMonitoring);

/**
 * @swagger
 * /alerts/monitor/stop:
 *   post:
 *     summary: Stop alert monitoring
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert monitoring stopped successfully
 *       401:
 *         description: Authentication required
 */
router.post('/monitor/stop', alertController.stopMonitoring);

module.exports = router; 