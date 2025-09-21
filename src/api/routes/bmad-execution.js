/**
 * BMAD Execution System API Routes
 * Provides endpoints for managing and monitoring the BMAD execution system
 */

const express = require('express');
const { getGlobalBMADSystem } = require('../middleware/bmad-execution-system');

const router = express.Router();

/**
 * Get BMAD execution system status
 */
router.get('/status', async (req, res) => {
    try {
        const bmadSystem = getGlobalBMADSystem();
        const status = bmadSystem.getSystemStatus();

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get BMAD execution system status',
            message: error.message
        });
    }
});

/**
 * Update BMAD execution system configuration
 */
router.post('/config', async (req, res) => {
    try {
        const bmadSystem = getGlobalBMADSystem();
        const result = await bmadSystem.updateConfiguration(req.body);

        if (result.success) {
            res.json({
                success: true,
                message: 'Configuration updated successfully',
                data: result.config
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to update configuration',
                message: result.error
            });
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update configuration',
            message: error.message
        });
    }
});

/**
 * Get current configuration
 */
router.get('/config', async (req, res) => {
    try {
        const bmadSystem = getGlobalBMADSystem();
        const config = bmadSystem.configManager.getAll();

        res.json({
            success: true,
            data: config
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get configuration',
            message: error.message
        });
    }
});

/**
 * Test BMAD detection on provided content
 */
router.post('/test-detection', async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Content is required for testing'
            });
        }

        const bmadSystem = getGlobalBMADSystem();
        const detection = bmadSystem.detector.detectBMAD(content);
        const metadata = bmadSystem.detector.extractProjectMetadata(content);

        res.json({
            success: true,
            data: {
                detection,
                metadata,
                executionMode: detection.isBMAD
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to test BMAD detection',
            message: error.message
        });
    }
});

/**
 * Execute a BMAD project manually
 */
router.post('/execute', async (req, res) => {
    try {
        const { content, metadata, options } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Content is required for execution'
            });
        }

        const bmadSystem = getGlobalBMADSystem();

        // Auto-detect metadata if not provided
        const projectMetadata = metadata || bmadSystem.detector.extractProjectMetadata(content);

        const executionResult = await bmadSystem.executeProject(
            content,
            projectMetadata,
            options || {}
        );

        res.json({
            success: true,
            data: executionResult
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to execute BMAD project',
            message: error.message
        });
    }
});

/**
 * Get execution history and statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const bmadSystem = getGlobalBMADSystem();
        const stats = bmadSystem.configManager.getStats();

        res.json({
            success: true,
            data: {
                ...stats,
                activeExecutions: bmadSystem.autoExecutor.getAllExecutions()
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get statistics',
            message: error.message
        });
    }
});

/**
 * Get execution status by ID
 */
router.get('/execution/:executionId', async (req, res) => {
    try {
        const { executionId } = req.params;
        const bmadSystem = getGlobalBMADSystem();
        const execution = bmadSystem.autoExecutor.getExecutionStatus(executionId);

        if (!execution) {
            return res.status(404).json({
                success: false,
                error: 'Execution not found'
            });
        }

        res.json({
            success: true,
            data: execution
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get execution status',
            message: error.message
        });
    }
});

/**
 * Enable/disable execution mode globally
 */
router.post('/toggle', async (req, res) => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled parameter must be a boolean'
            });
        }

        const bmadSystem = getGlobalBMADSystem();
        bmadSystem.configManager.setExecutionMode(enabled);

        await bmadSystem.configManager.saveConfig();

        res.json({
            success: true,
            message: `BMAD execution mode ${enabled ? 'enabled' : 'disabled'}`,
            data: { enabled }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to toggle execution mode',
            message: error.message
        });
    }
});

/**
 * Validate a response against execution mode guidelines
 */
router.post('/validate-response', async (req, res) => {
    try {
        const { response } = req.body;

        if (!response) {
            return res.status(400).json({
                success: false,
                error: 'Response is required for validation'
            });
        }

        const bmadSystem = getGlobalBMADSystem();
        const validation = bmadSystem.configManager.validateExecutionResponse(response);

        res.json({
            success: true,
            data: validation
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to validate response',
            message: error.message
        });
    }
});

/**
 * Get response templates
 */
router.get('/templates', async (req, res) => {
    try {
        const bmadSystem = getGlobalBMADSystem();
        const templates = bmadSystem.configManager.get('responses.templates');

        res.json({
            success: true,
            data: templates || {}
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get response templates',
            message: error.message
        });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const bmadSystem = getGlobalBMADSystem();
        const isHealthy = bmadSystem && bmadSystem.configManager;

        res.json({
            success: true,
            data: {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                components: {
                    detector: !!bmadSystem.detector,
                    interceptor: !!bmadSystem.interceptor,
                    promptModifier: !!bmadSystem.promptModifier,
                    autoExecutor: !!bmadSystem.autoExecutor,
                    configManager: !!bmadSystem.configManager
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error.message
        });
    }
});

module.exports = router;