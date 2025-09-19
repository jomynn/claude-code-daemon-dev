/**
 * Usage API Routes
 * Endpoints for usage data and statistics
 */

const express = require('express');
const router = express.Router();
const UsageMonitor = require('../../daemon/usage-monitor');

const usageMonitor = new UsageMonitor();

// Initialize monitor
(async () => {
    try {
        await usageMonitor.initialize();
    } catch (error) {
        console.error('Failed to initialize usage monitor:', error);
    }
})();

// Get current usage
router.get('/current', async (req, res) => {
    try {
        const usage = await usageMonitor.getCurrentUsage();
        res.json({
            success: true,
            data: usage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get usage history
router.get('/history', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const history = await usageMonitor.getRecentUsageData(parseInt(hours));
        res.json({
            success: true,
            data: history,
            count: history.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get usage predictions
router.get('/predictions', async (req, res) => {
    try {
        const predictions = usageMonitor.predictions;
        res.json({
            success: true,
            data: predictions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force update predictions
router.post('/predictions/update', async (req, res) => {
    try {
        await usageMonitor.updatePredictions();
        res.json({
            success: true,
            message: 'Predictions updated',
            data: usageMonitor.predictions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get usage statistics
router.get('/stats', async (req, res) => {
    try {
        const { period = 'day' } = req.query;
        const hours = {
            hour: 1,
            day: 24,
            week: 168,
            month: 720
        }[period] || 24;

        const data = await usageMonitor.getRecentUsageData(hours);

        // Calculate statistics
        const tokens = data.map(d => d.tokens || 0);
        const requests = data.map(d => d.requests || 0);

        const stats = {
            period,
            dataPoints: data.length,
            tokens: {
                total: tokens.reduce((sum, t) => sum + t, 0),
                average: tokens.length > 0 ? tokens.reduce((sum, t) => sum + t, 0) / tokens.length : 0,
                max: Math.max(...tokens, 0),
                min: Math.min(...tokens, 0)
            },
            requests: {
                total: requests.reduce((sum, r) => sum + r, 0),
                average: requests.length > 0 ? requests.reduce((sum, r) => sum + r, 0) / requests.length : 0,
                max: Math.max(...requests, 0),
                min: Math.min(...requests, 0)
            }
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force collect usage data
router.post('/collect', async (req, res) => {
    try {
        await usageMonitor.collectUsageData();
        res.json({
            success: true,
            message: 'Usage data collected',
            data: await usageMonitor.getCurrentUsage()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Export usage data
router.get('/export', async (req, res) => {
    try {
        const { format = 'json', hours = 24 } = req.query;
        const data = await usageMonitor.getRecentUsageData(parseInt(hours));

        if (format === 'csv') {
            // Convert to CSV
            const csv = [
                'timestamp,tokens,requests,tokens_per_hour,requests_per_hour',
                ...data.map(d => `${d.timestamp},${d.tokens},${d.requests},${d.tokens_per_hour},${d.requests_per_hour}`)
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="usage-data.csv"');
            res.send(csv);
        } else {
            res.json({
                success: true,
                data,
                count: data.length
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
