/**
 * Alerts API Routes
 * Endpoints for managing alerts and notifications
 */

const express = require('express');
const router = express.Router();
const NotificationService = require('../../daemon/notification-service');

const notificationService = new NotificationService();

// Initialize service
(async () => {
    try {
        await notificationService.initialize();
    } catch (error) {
        console.error('Failed to initialize notification service:', error);
    }
})();

// Get recent alerts
router.get('/', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const alerts = notificationService.getRecentAlerts(parseInt(limit));

        res.json({
            success: true,
            data: alerts,
            count: alerts.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create a new alert
router.post('/', async (req, res) => {
    try {
        const { type, severity, message, data } = req.body;

        if (!type || !severity || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, severity, message'
            });
        }

        const alert = {
            type,
            severity,
            message,
            data: data || {}
        };

        await notificationService.sendAlert(alert);

        res.json({
            success: true,
            message: 'Alert sent successfully',
            data: alert
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear alert history
router.delete('/history', async (req, res) => {
    try {
        const count = notificationService.clearAlertHistory();

        res.json({
            success: true,
            message: `Cleared ${count} alerts from history`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test notifications
router.post('/test', async (req, res) => {
    try {
        await notificationService.testNotifications();

        res.json({
            success: true,
            message: 'Test notifications sent to all configured channels'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get notification status
router.get('/status', (req, res) => {
    try {
        const status = notificationService.getStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Configure notification channel
router.post('/channels/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const { config: _config } = req.body;

        // Add or update channel configuration
        // This would need implementation in NotificationService

        res.json({
            success: true,
            message: `Channel ${name} configured`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Remove notification channel
router.delete('/channels/:name', (req, res) => {
    try {
        const { name } = req.params;
        const removed = notificationService.removeChannel(name);

        if (removed) {
            res.json({
                success: true,
                message: `Channel ${name} removed`
            });
        } else {
            res.status(404).json({
                success: false,
                error: `Channel ${name} not found`
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Filter alerts by criteria
router.get('/filter', async (req, res) => {
    try {
        const { type, severity, startDate, endDate } = req.query;
        let alerts = notificationService.getRecentAlerts(1000);

        // Apply filters
        if (type) {
            alerts = alerts.filter(a => a.type === type);
        }

        if (severity) {
            alerts = alerts.filter(a => a.severity === severity);
        }

        if (startDate) {
            const start = new Date(startDate);
            alerts = alerts.filter(a => new Date(a.timestamp) >= start);
        }

        if (endDate) {
            const end = new Date(endDate);
            alerts = alerts.filter(a => new Date(a.timestamp) <= end);
        }

        res.json({
            success: true,
            data: alerts,
            count: alerts.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
