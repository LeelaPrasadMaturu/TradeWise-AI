const TradeAlert = require('../models/TradeAlert');
const alertMonitorService = require('../services/alertMonitorService');

// Create a new trade alert
exports.createAlert = async (req, res) => {
  try {
    const alertData = {
      ...req.body,
      user: req.user._id,
      currentPrice: req.body.currentPrice || 0
    };

    const alert = new TradeAlert(alertData);
    await alert.save();

    res.status(201).json({
      success: true,
      data: alert
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get all alerts for a user
exports.getUserAlerts = async (req, res) => {
  try {
    const alerts = await TradeAlert.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Update an alert
exports.updateAlert = async (req, res) => {
  try {
    const alert = await TradeAlert.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.status(200).json({
      success: true,
      data: alert
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Delete an alert
exports.deleteAlert = async (req, res) => {
  try {
    const alert = await TradeAlert.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get alert statistics
exports.getAlertStats = async (req, res) => {
  try {
    const stats = await TradeAlert.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Start monitoring alerts
exports.startMonitoring = async (req, res) => {
  try {
    await alertMonitorService.startMonitoring();
    res.status(200).json({
      success: true,
      message: 'Alert monitoring started'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Stop monitoring alerts
exports.stopMonitoring = async (req, res) => {
  try {
    await alertMonitorService.stopMonitoring();
    res.status(200).json({
      success: true,
      message: 'Alert monitoring stopped'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}; 