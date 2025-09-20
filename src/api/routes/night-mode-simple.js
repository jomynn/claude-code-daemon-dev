/**
 * Simplified Night Mode API Routes
 */

const express = require('express');
const router = express.Router();

// Simple night mode status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        data: {
            isActive: false,
            currentProject: null,
            queueLength: 0,
            config: {
                startHour: 23,
                endHour: 6,
                autoCommit: true,
                autoTest: true
            }
        }
    });
});

// Simple queue endpoint
router.post('/queue-from-brainstorm', (req, res) => {
    const { brainstormData } = req.body;

    res.json({
        success: true,
        message: `Project "${brainstormData.projectName}" queued for night development`,
        data: {
            id: `night-${Date.now()}`,
            name: brainstormData.projectName,
            status: 'queued',
            queuedAt: new Date(),
            priority: 1
        }
    });
});

// Get queue
router.get('/queue', (req, res) => {
    res.json({
        success: true,
        data: {
            queue: [],
            count: 0
        }
    });
});

module.exports = router;