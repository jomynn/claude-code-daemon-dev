/**
 * Slack Integration API Routes
 * Provides endpoints for managing Slack bot and channels
 */

const express = require('express');
const router = express.Router();
const winston = require('winston');

// This will be injected by the server
let notificationService = null;

// Initialize with notification service instance
router.setNotificationService = (service) => {
    notificationService = service;
};

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/api.log' }),
        new winston.transports.Console()
    ]
});

// Get Slack service status
router.get('/status', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const status = notificationService.getSlackServiceStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error('Error getting Slack status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get current Slack channel configuration
router.get('/channels', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const channels = notificationService.getSlackChannelConfig();
        res.json({
            success: true,
            data: channels || {}
        });
    } catch (error) {
        logger.error('Error getting Slack channels:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update Slack channel configuration
router.put('/channels', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const { channels } = req.body;

        if (!channels || typeof channels !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid channels configuration'
            });
        }

        // Validate channel names
        const validChannelKeys = ['alerts', 'status', 'commands', 'general'];
        const invalidChannels = Object.keys(channels).filter(key => !validChannelKeys.includes(key));

        if (invalidChannels.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid channel keys: ${invalidChannels.join(', ')}. Valid keys: ${validChannelKeys.join(', ')}`
            });
        }

        const updated = await notificationService.updateSlackChannels(channels);

        if (updated) {
            res.json({
                success: true,
                message: 'Slack channels updated successfully',
                data: notificationService.getSlackChannelConfig()
            });
        } else {
            res.status(503).json({
                success: false,
                error: 'Slack service not available'
            });
        }
    } catch (error) {
        logger.error('Error updating Slack channels:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send a custom message to a Slack channel
router.post('/message', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const { message, channel = 'general', options = {} } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        const sent = await notificationService.sendSlackMessage(message, channel, options);

        if (sent) {
            res.json({
                success: true,
                message: 'Message sent to Slack successfully'
            });
        } else {
            res.status(503).json({
                success: false,
                error: 'Failed to send message to Slack'
            });
        }
    } catch (error) {
        logger.error('Error sending Slack message:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send a test alert to Slack
router.post('/test-alert', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const { severity = 'info', channel = 'general' } = req.body;

        const testAlert = {
            type: 'slack-test',
            severity: severity,
            message: 'This is a test alert from Claude Code Daemon Slack integration',
            data: {
                test: true,
                timestamp: new Date().toISOString(),
                requestedBy: req.ip
            }
        };

        await notificationService.sendAlert(testAlert);

        res.json({
            success: true,
            message: 'Test alert sent successfully',
            data: testAlert
        });
    } catch (error) {
        logger.error('Error sending test alert:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get available Slack commands
router.get('/commands', async (req, res) => {
    try {
        const commands = [
            {
                command: '/claude-help',
                description: 'Show all available Claude Code Daemon commands',
                usage: '/claude-help'
            },
            {
                command: '/claude-status',
                description: 'Get system status and health information',
                usage: '/claude-status'
            },
            {
                command: '/claude-projects',
                description: 'List all projects with their current status',
                usage: '/claude-projects'
            },
            {
                command: '/claude-start',
                description: 'Start Claude Code for a specific project',
                usage: '/claude-start [project-name]'
            },
            {
                command: '/claude-stop',
                description: 'Stop Claude Code for a specific project',
                usage: '/claude-stop [project-name]'
            },
            {
                command: '/claude-bmad',
                description: 'Start BMAD workflow for a project',
                usage: '/claude-bmad [project-name] [workflow-type]'
            },
            {
                command: '/claude-logs',
                description: 'Get recent system logs',
                usage: '/claude-logs [number-of-lines]'
            },
            {
                command: '/claude-alerts',
                description: 'Get recent alerts and notifications',
                usage: '/claude-alerts'
            },
            {
                command: '/claude-usage',
                description: 'Get usage statistics and metrics',
                usage: '/claude-usage'
            },
            {
                command: '/claude-health',
                description: 'Perform a comprehensive health check',
                usage: '/claude-health'
            }
        ];

        res.json({
            success: true,
            data: {
                commands: commands,
                total: commands.length
            }
        });
    } catch (error) {
        logger.error('Error getting Slack commands:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send system status update to Slack
router.post('/status-update', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        // Get current system status (this should integrate with your existing status API)
        const status = {
            running: true,
            uptime: '3h 45m',
            memory: '178 MB',
            activeProjects: 5,
            timestamp: new Date().toISOString()
        };

        const sent = await notificationService.sendSlackStatusUpdate(status);

        if (sent) {
            res.json({
                success: true,
                message: 'Status update sent to Slack successfully',
                data: status
            });
        } else {
            res.status(503).json({
                success: false,
                error: 'Failed to send status update to Slack'
            });
        }
    } catch (error) {
        logger.error('Error sending status update:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Notify about project status changes
router.post('/notify/project-status', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const { projectName, oldStatus, newStatus, userId } = req.body;

        if (!projectName || !oldStatus || !newStatus) {
            return res.status(400).json({
                success: false,
                error: 'projectName, oldStatus, and newStatus are required'
            });
        }

        await notificationService.notifyProjectStatusChange(projectName, oldStatus, newStatus, userId);

        res.json({
            success: true,
            message: 'Project status change notification sent successfully'
        });
    } catch (error) {
        logger.error('Error sending project status notification:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Notify about Claude session changes
router.post('/notify/claude-session', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const { action, projectName, userId, details = {} } = req.body;

        if (!action || !projectName) {
            return res.status(400).json({
                success: false,
                error: 'action and projectName are required'
            });
        }

        const validActions = ['started', 'stopped', 'paused', 'resumed', 'error'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                error: `Invalid action. Valid actions: ${validActions.join(', ')}`
            });
        }

        await notificationService.notifyClaudeSession(action, projectName, userId, details);

        res.json({
            success: true,
            message: 'Claude session notification sent successfully'
        });
    } catch (error) {
        logger.error('Error sending Claude session notification:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Notify about BMAD workflow changes
router.post('/notify/bmad-workflow', async (req, res) => {
    try {
        if (!notificationService) {
            return res.status(503).json({
                success: false,
                error: 'Notification service not available'
            });
        }

        const { action, projectName, workflow, userId, details = {} } = req.body;

        if (!action || !projectName || !workflow) {
            return res.status(400).json({
                success: false,
                error: 'action, projectName, and workflow are required'
            });
        }

        const validActions = ['started', 'completed', 'failed', 'paused'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                error: `Invalid action. Valid actions: ${validActions.join(', ')}`
            });
        }

        await notificationService.notifyBmadWorkflow(action, projectName, workflow, userId, details);

        res.json({
            success: true,
            message: 'BMAD workflow notification sent successfully'
        });
    } catch (error) {
        logger.error('Error sending BMAD workflow notification:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;