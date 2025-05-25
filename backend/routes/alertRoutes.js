const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Alert CRUD operations
router.post('/', alertController.createAlert);
router.get('/', alertController.getUserAlerts);
router.put('/:id', alertController.updateAlert);
router.delete('/:id', alertController.deleteAlert);

// Alert statistics
router.get('/stats', alertController.getAlertStats);

// Monitoring control
router.post('/monitor/start', alertController.startMonitoring);
router.post('/monitor/stop', alertController.stopMonitoring);

module.exports = router; 