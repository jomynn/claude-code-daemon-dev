/**
 * BMAD Integration Routes
 * Provides endpoints for BMAD-METHOD integration and workflow management
 */

const express = require('express');
const router = express.Router();

// BMAD workflow status
router.get('/status', async (req, res) => {
    try {
        const bmadStatus = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            enabled: process.env.BMAD_ENABLED === 'true',
            integration: {
                claude: {
                    connected: true,
                    lastSync: new Date().toISOString(),
                    status: 'active'
                },
                workflows: {
                    active: await getActiveWorkflows(),
                    completed: await getCompletedWorkflows(),
                    failed: await getFailedWorkflows()
                }
            },
            agents: {
                available: getBmadAgents(),
                active: getActiveAgents()
            },
            performance: {
                averageResponseTime: 250,
                successRate: 98.5,
                totalRequests: 1247
            }
        };

        res.json({
            status: 'success',
            data: bmadStatus
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get BMAD status',
            error: error.message
        });
    }
});

// Start BMAD workflow
router.post('/workflow/start', async (req, res) => {
    try {
        const { type, parameters, agents } = req.body;

        if (!type) {
            return res.status(400).json({
                status: 'error',
                message: 'Workflow type is required'
            });
        }

        const workflow = {
            id: generateWorkflowId(),
            type,
            parameters: parameters || {},
            agents: agents || ['dev', 'qa'],
            status: 'initializing',
            createdAt: new Date().toISOString(),
            steps: []
        };

        // Initialize workflow
        const initializedWorkflow = await initializeWorkflow(workflow);

        res.status(201).json({
            status: 'success',
            message: 'Workflow started successfully',
            data: initializedWorkflow
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to start workflow',
            error: error.message
        });
    }
});

// Get workflow status
router.get('/workflow/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await getWorkflowById(id);

        if (!workflow) {
            return res.status(404).json({
                status: 'error',
                message: `Workflow ${id} not found`
            });
        }

        res.json({
            status: 'success',
            data: workflow
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get workflow status',
            error: error.message
        });
    }
});

// List workflows
router.get('/workflows', async (req, res) => {
    try {
        const { status, type, limit = 50, offset = 0 } = req.query;

        const filters = {
            status: status || undefined,
            type: type || undefined
        };

        const workflows = await getWorkflows(filters, parseInt(limit), parseInt(offset));

        res.json({
            status: 'success',
            data: {
                workflows,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: workflows.length
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to list workflows',
            error: error.message
        });
    }
});

// Stop workflow
router.post('/workflow/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const workflow = await getWorkflowById(id);

        if (!workflow) {
            return res.status(404).json({
                status: 'error',
                message: `Workflow ${id} not found`
            });
        }

        if (workflow.status === 'completed' || workflow.status === 'failed') {
            return res.status(400).json({
                status: 'error',
                message: `Workflow ${id} is already ${workflow.status}`
            });
        }

        const stoppedWorkflow = await stopWorkflow(id, reason || 'Manual stop');

        res.json({
            status: 'success',
            message: 'Workflow stopped successfully',
            data: stoppedWorkflow
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to stop workflow',
            error: error.message
        });
    }
});

// Get available agents
router.get('/agents', async (req, res) => {
    try {
        const agents = getBmadAgents();

        res.json({
            status: 'success',
            data: {
                agents,
                total: agents.length
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get agents',
            error: error.message
        });
    }
});

// Get agent details
router.get('/agents/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const agent = await getAgentDetails(name);

        if (!agent) {
            return res.status(404).json({
                status: 'error',
                message: `Agent ${name} not found`
            });
        }

        res.json({
            status: 'success',
            data: agent
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get agent details',
            error: error.message
        });
    }
});

// Execute BMAD command
router.post('/execute', async (req, res) => {
    try {
        const { command, agent, parameters } = req.body;

        if (!command || !agent) {
            return res.status(400).json({
                status: 'error',
                message: 'Command and agent are required'
            });
        }

        const execution = {
            id: generateExecutionId(),
            command,
            agent,
            parameters: parameters || {},
            status: 'executing',
            startedAt: new Date().toISOString()
        };

        // Execute command asynchronously
        const result = await executeBmadCommand(execution);

        res.json({
            status: 'success',
            message: 'Command executed successfully',
            data: result
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to execute command',
            error: error.message
        });
    }
});

// Get BMAD metrics
router.get('/metrics', async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;

        const metrics = await getBmadMetrics(timeframe);

        res.json({
            status: 'success',
            data: metrics
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get BMAD metrics',
            error: error.message
        });
    }
});

// Webhook for BMAD events
router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;

        // Validate webhook signature if configured
        if (process.env.BMAD_WEBHOOK_SECRET) {
            const signature = req.headers['x-bmad-signature'];
            if (!validateWebhookSignature(signature, event)) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid webhook signature'
                });
            }
        }

        // Process the webhook event
        await processBmadWebhookEvent(event);

        res.json({
            status: 'success',
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to process webhook',
            error: error.message
        });
    }
});

// Helper functions
function generateWorkflowId() {
    return `bmad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateExecutionId() {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function initializeWorkflow(workflow) {
    // Mock workflow initialization
    workflow.status = 'running';
    workflow.steps.push({
        id: 1,
        name: 'initialization',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
    });

    return workflow;
}

async function getWorkflowById(id) {
    // Mock workflow retrieval
    return {
        id,
        type: 'development',
        status: 'running',
        createdAt: new Date().toISOString(),
        agents: ['dev', 'qa'],
        steps: [
            {
                id: 1,
                name: 'code_analysis',
                status: 'completed',
                agent: 'dev',
                result: 'Analysis complete'
            },
            {
                id: 2,
                name: 'testing',
                status: 'running',
                agent: 'qa',
                startedAt: new Date().toISOString()
            }
        ]
    };
}

async function getWorkflows(_filters, _limit, _offset) {
    // Mock workflow listing
    return [
        {
            id: 'bmad-1234567890-abc123',
            type: 'development',
            status: 'completed',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            completedAt: new Date().toISOString()
        },
        {
            id: 'bmad-1234567891-def456',
            type: 'review',
            status: 'running',
            createdAt: new Date(Date.now() - 1800000).toISOString()
        }
    ];
}

async function stopWorkflow(id, reason) {
    // Mock workflow stopping
    return {
        id,
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
        reason
    };
}

function getBmadAgents() {
    return [
        {
            name: 'dev',
            displayName: 'Development Agent',
            description: 'Handles development tasks and code analysis',
            capabilities: ['code_analysis', 'debugging', 'optimization'],
            status: 'active'
        },
        {
            name: 'qa',
            displayName: 'Quality Assurance Agent',
            description: 'Handles testing and quality assurance',
            capabilities: ['testing', 'validation', 'bug_detection'],
            status: 'active'
        },
        {
            name: 'pm',
            displayName: 'Project Manager Agent',
            description: 'Handles project management and coordination',
            capabilities: ['planning', 'coordination', 'reporting'],
            status: 'active'
        },
        {
            name: 'po',
            displayName: 'Product Owner Agent',
            description: 'Handles product requirements and prioritization',
            capabilities: ['requirements', 'prioritization', 'stakeholder_management'],
            status: 'active'
        }
    ];
}

function getActiveAgents() {
    return ['dev', 'qa', 'pm'];
}

async function getActiveWorkflows() {
    return 3;
}

async function getCompletedWorkflows() {
    return 15;
}

async function getFailedWorkflows() {
    return 1;
}

async function getAgentDetails(name) {
    const agents = getBmadAgents();
    const agent = agents.find(a => a.name === name);

    if (!agent) {return null;}

    return {
        ...agent,
        statistics: {
            totalTasks: 45,
            completedTasks: 42,
            failedTasks: 2,
            averageResponseTime: 180,
            successRate: 93.3
        },
        currentTasks: [
            {
                id: 'task-123',
                type: 'code_analysis',
                status: 'running',
                startedAt: new Date().toISOString()
            }
        ]
    };
}

async function executeBmadCommand(execution) {
    // Mock command execution
    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
    execution.result = {
        success: true,
        output: 'Command executed successfully',
        duration: 150
    };

    return execution;
}

async function getBmadMetrics(timeframe) {
    return {
        timeframe,
        period: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
        },
        workflows: {
            total: 25,
            completed: 22,
            failed: 2,
            running: 1
        },
        agents: {
            utilization: {
                dev: 85.2,
                qa: 78.9,
                pm: 65.4,
                po: 45.7
            },
            performance: {
                averageResponseTime: 225,
                successRate: 94.2
            }
        },
        resources: {
            cpuUsage: 45.8,
            memoryUsage: 67.3,
            activeConnections: 12
        }
    };
}

function validateWebhookSignature(_signature, _payload) {
    // Mock signature validation
    return true;
}

async function processBmadWebhookEvent(event) {
    // Mock event processing
    console.log('Processing BMAD webhook event:', event.type);

    // This would typically:
    // 1. Update workflow status
    // 2. Trigger notifications
    // 3. Update metrics
    // 4. Log the event
}

module.exports = router;
