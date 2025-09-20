/**
 * Night Mode API Routes
 * Handles night mode automatic development endpoints
 */

const express = require('express');
const router = express.Router();
const NightModeService = require('../../services/night-mode');

// Initialize night mode service
const nightMode = new NightModeService();
nightMode.initialize();

/**
 * Get night mode status
 */
router.get('/status', (req, res) => {
    const status = nightMode.getStatus();
    res.json({
        success: true,
        data: status
    });
});

/**
 * Queue a project for night development
 */
router.post('/queue', async (req, res) => {
    try {
        const projectData = req.body;

        // Validate project data
        if (!projectData.name || !projectData.brief) {
            return res.status(400).json({
                success: false,
                error: 'Project name and brief are required'
            });
        }

        const queued = await nightMode.queueProject(projectData);

        res.json({
            success: true,
            message: `Project "${projectData.name}" queued for night development`,
            data: queued
        });
    } catch (error) {
        console.error('Error queuing project:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Start night mode manually
 */
router.post('/start', async (req, res) => {
    try {
        if (nightMode.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Night mode is already active'
            });
        }

        await nightMode.startNightMode();

        res.json({
            success: true,
            message: 'Night mode started manually'
        });
    } catch (error) {
        console.error('Error starting night mode:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Stop night mode manually
 */
router.post('/stop', async (req, res) => {
    try {
        if (!nightMode.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Night mode is not active'
            });
        }

        await nightMode.stopNightMode();

        res.json({
            success: true,
            message: 'Night mode stopped',
            summary: nightMode.progress
        });
    } catch (error) {
        console.error('Error stopping night mode:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get development queue
 */
router.get('/queue', (req, res) => {
    res.json({
        success: true,
        data: {
            queue: nightMode.developmentQueue,
            count: nightMode.developmentQueue.length
        }
    });
});

/**
 * Remove project from queue
 */
router.delete('/queue/:projectId', (req, res) => {
    const { projectId } = req.params;
    const index = nightMode.developmentQueue.findIndex(p => p.id === projectId);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            error: 'Project not found in queue'
        });
    }

    const removed = nightMode.developmentQueue.splice(index, 1)[0];

    res.json({
        success: true,
        message: `Project "${removed.name}" removed from queue`,
        data: removed
    });
});

/**
 * Get morning summary
 */
router.get('/summary', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const fs = require('fs-extra');
        const path = require('path');

        const summaryPath = path.join(
            __dirname,
            '../../../data/night-mode-summaries',
            `${date}.json`
        );

        if (await fs.pathExists(summaryPath)) {
            const summary = await fs.readJson(summaryPath);
            res.json({
                success: true,
                data: summary
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'No summary found for this date'
            });
        }
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Update night mode configuration
 */
router.put('/config', async (req, res) => {
    try {
        const newConfig = req.body;
        await nightMode.updateConfig(newConfig);

        res.json({
            success: true,
            message: 'Night mode configuration updated',
            data: nightMode.config
        });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get night mode configuration
 */
router.get('/config', (req, res) => {
    res.json({
        success: true,
        data: nightMode.config
    });
});

/**
 * Queue project from brainstorm
 */
router.post('/queue-from-brainstorm', async (req, res) => {
    try {
        const { brainstormData } = req.body;

        // Transform brainstorm data to project format
        const projectData = {
            id: `night-${Date.now()}`,
            name: brainstormData.projectName,
            brief: {
                overview: brainstormData.overview,
                objectives: brainstormData.objectives,
                scope: brainstormData.scope
            },
            features: brainstormData.features.map(f => ({
                name: f,
                priority: 1,
                complexity: 'medium'
            })),
            techStack: brainstormData.techStack,
            workflow: brainstormData.workflow || 'agile',
            priority: brainstormData.priority || 1
        };

        const queued = await nightMode.queueProject(projectData);

        res.json({
            success: true,
            message: 'Project queued from brainstorm for night development',
            data: queued
        });
    } catch (error) {
        console.error('Error queuing from brainstorm:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// WebSocket event handlers for real-time updates
nightMode.on('night-mode:started', () => {
    if (global.io) {
        global.io.emit('night-mode:started', {
            time: new Date(),
            message: 'Night mode automatic development started'
        });
    }
});

nightMode.on('night-mode:stopped', (summary) => {
    if (global.io) {
        global.io.emit('night-mode:stopped', {
            time: new Date(),
            message: 'Night mode stopped',
            summary
        });
    }
});

nightMode.on('phase:completed', (data) => {
    if (global.io) {
        global.io.emit('night-mode:phase-completed', data);
    }
});

nightMode.on('project:completed', (project) => {
    if (global.io) {
        global.io.emit('night-mode:project-completed', project);
    }
});

module.exports = router;