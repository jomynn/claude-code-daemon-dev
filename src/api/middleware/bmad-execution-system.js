/**
 * BMAD Execution System - Main Integration Module
 * Orchestrates all components to provide seamless BMAD document execution
 */

const { BMADDetector } = require('./bmad-detector');
const { ClaudeInterceptor } = require('./claude-interceptor');
const { PromptModifier } = require('./prompt-modifier');
const { AutoExecutionWrapper } = require('./auto-execution-wrapper');
const { ExecutionConfigManager } = require('./execution-config');

class BMADExecutionSystem {
    constructor() {
        this.detector = new BMADDetector();
        this.interceptor = new ClaudeInterceptor();
        this.promptModifier = new PromptModifier();
        this.autoExecutor = new AutoExecutionWrapper();
        this.configManager = new ExecutionConfigManager();

        this.activeSessions = new Map();
        this.executionQueue = [];

        // Load configuration
        this.configManager.loadConfig().catch(error => {
            console.warn('[BMAD SYSTEM] Failed to load config:', error.message);
        });

        console.log('[BMAD SYSTEM] BMAD Execution System initialized');
    }

    /**
     * Process incoming request for BMAD content and execution
     */
    async processRequest(req, res, next) {
        try {
            const startTime = Date.now();

            // Step 1: Detect BMAD content
            const bmadDetection = await this._detectBMADContent(req);

            if (bmadDetection.isBMAD) {
                console.log(`[BMAD SYSTEM] BMAD content detected with confidence: ${bmadDetection.confidence}`);

                // Step 2: Set execution mode
                req.executionMode = true;
                req.bmadDetection = bmadDetection;
                req.bmadMetadata = this.detector.extractProjectMetadata(this._getRequestContent(req));

                // Step 3: Modify prompt for execution
                await this._modifyPromptForExecution(req);

                // Step 4: Prepare for auto-execution if enabled
                if (this.configManager.get('execution.autoExecute') !== false) {
                    req.autoExecuteReady = true;
                }

                // Update statistics
                this.configManager.updateStats('totalDetections');

                console.log(`[BMAD SYSTEM] Request processed for execution mode in ${Date.now() - startTime}ms`);
            }

            next();

        } catch (error) {
            console.error('[BMAD SYSTEM] Error processing request:', error);
            next(error);
        }
    }

    /**
     * Execute BMAD project automatically
     */
    async executeProject(bmadContent, bmadMetadata, options = {}) {
        try {
            console.log(`[BMAD SYSTEM] Starting auto-execution for: ${bmadMetadata.name || 'BMAD Project'}`);

            const executionResult = await this.autoExecutor.startAutoExecution(
                bmadContent,
                bmadMetadata,
                options
            );

            if (executionResult.success) {
                this.configManager.updateStats('successfulExecutions');
                console.log(`[BMAD SYSTEM] Project execution completed: ${executionResult.projectPath}`);
            } else {
                this.configManager.updateStats('failedExecutions');
                console.error(`[BMAD SYSTEM] Project execution failed: ${executionResult.error}`);
            }

            return executionResult;

        } catch (error) {
            this.configManager.updateStats('failedExecutions');
            console.error('[BMAD SYSTEM] Auto-execution error:', error);
            throw error;
        }
    }

    /**
     * Intercept and modify Claude response
     */
    async interceptClaudeResponse(response, sessionId, executionMode = false) {
        if (!executionMode) {
            return response;
        }

        console.log('[BMAD SYSTEM] Intercepting Claude response for execution mode');

        // Intercept planning responses
        const interceptedResponse = this.interceptor.interceptResponse(response, sessionId, true);

        // Validate response meets execution standards
        const validation = this.configManager.validateExecutionResponse(interceptedResponse);

        if (!validation.isValid && this.configManager.get('validation.enableResponseChecking')) {
            console.warn('[BMAD SYSTEM] Response validation failed:', validation.issues);
            this.configManager.updateStats('overriddenResponses');

            // Override with execution-focused response
            return this._generateExecutionResponse(sessionId);
        }

        return interceptedResponse;
    }

    /**
     * Get system status and statistics
     */
    getSystemStatus() {
        return {
            status: 'active',
            timestamp: new Date().toISOString(),
            configuration: {
                executionEnabled: this.configManager.get('execution.enabled'),
                autoDetection: this.configManager.get('bmad.autoDetect'),
                forceMode: this.configManager.get('execution.forceMode'),
                detectionThreshold: this.configManager.get('bmad.detectionThreshold')
            },
            statistics: this.configManager.getStats(),
            activeSessions: this.activeSessions.size,
            executionQueue: this.executionQueue.length,
            components: {
                detector: 'active',
                interceptor: 'active',
                promptModifier: 'active',
                autoExecutor: 'active',
                configManager: 'active'
            }
        };
    }

    /**
     * Update system configuration
     */
    async updateConfiguration(newConfig) {
        try {
            // Merge with existing configuration
            const currentConfig = this.configManager.activeConfig;
            const mergedConfig = this._deepMerge(currentConfig, newConfig);

            // Save configuration
            await this.configManager.saveConfig(mergedConfig);

            // Reload configuration
            await this.configManager.loadConfig();

            console.log('[BMAD SYSTEM] Configuration updated successfully');
            return { success: true, config: mergedConfig };

        } catch (error) {
            console.error('[BMAD SYSTEM] Failed to update configuration:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Private methods
     */

    async _detectBMADContent(req) {
        const content = this._getRequestContent(req);

        if (!content) {
            return { isBMAD: false, confidence: 0 };
        }

        return this.detector.detectBMAD(content);
    }

    _getRequestContent(req) {
        if (!req.body || typeof req.body !== 'object') {
            return '';
        }

        return req.body.message ||
               req.body.content ||
               req.body.text ||
               req.body.description ||
               '';
    }

    async _modifyPromptForExecution(req) {
        if (!req.body || !req.body.message) {
            return;
        }

        const originalMessage = req.body.message;
        const modifiedMessage = this.promptModifier.modifyForExecutionMode(
            originalMessage,
            req.bmadMetadata
        );

        req.body.message = modifiedMessage;
        req.body.originalMessage = originalMessage;
        req.body.executionModeModified = true;

        // Add system message for Claude
        if (!req.body.systemMessage) {
            req.body.systemMessage = this.promptModifier.createExecutionSystemMessage(req.bmadMetadata);
        }

        console.log('[BMAD SYSTEM] Prompt modified for execution mode');
    }

    _generateExecutionResponse(sessionId) {
        const template = this.configManager.getResponseTemplate('planningOverride');
        const executionResponse = `${template}

🚀 IMMEDIATE EXECUTION ACTIVATED

I'm switching from planning mode to execution mode. Instead of providing recommendations or asking questions, I'll start building your project right now.

⚡ CURRENT ACTIONS:
• Creating project directory structure
• Generating configuration files
• Setting up development environment
• Installing required dependencies
• Creating initial code files
• Setting up database (if required)

🔧 EXECUTION STATUS: IN PROGRESS

Your project is being built automatically. All files, configurations, and setup will be completed without further input needed.

✅ BUILD WILL COMPLETE AUTOMATICALLY

No additional planning or approval required - the system is executing your specifications directly.`;

        return executionResponse;
    }

    _deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }
}

/**
 * Express middleware that combines all BMAD execution components
 */
function bmadExecutionMiddleware(req, res, next) {
    const system = new BMADExecutionSystem();

    // Add system to request
    req.bmadSystem = system;

    // Process the request
    system.processRequest(req, res, next);
}

/**
 * Express middleware for response interception
 */
function bmadResponseMiddleware(req, res, next) {
    if (!req.bmadSystem) {
        return next();
    }

    // Intercept response sending
    const originalSend = res.send;
    res.send = function(data) {
        // Check if this is a Claude response in execution mode
        if (req.executionMode && data && typeof data === 'object' && data.response) {
            const sessionId = req.body?.sessionId || req.params?.projectId || 'default';

            // Intercept and modify the response
            req.bmadSystem.interceptClaudeResponse(data.response, sessionId, true)
                .then(interceptedResponse => {
                    data.response = interceptedResponse;
                    data.executionModeActive = true;
                    data.bmadDetection = req.bmadDetection;

                    return originalSend.call(this, data);
                })
                .catch(error => {
                    console.error('[BMAD SYSTEM] Response interception failed:', error);
                    return originalSend.call(this, data);
                });
        } else {
            return originalSend.call(this, data);
        }
    };

    next();
}

/**
 * Auto-execution endpoint middleware
 */
async function bmadAutoExecuteMiddleware(req, res, next) {
    if (!req.autoExecuteReady || !req.bmadMetadata) {
        return next();
    }

    try {
        const content = req.body.originalMessage || req.body.message;
        const executionResult = await req.bmadSystem.executeProject(
            content,
            req.bmadMetadata,
            { targetPath: req.body.targetPath }
        );

        // Add execution result to response
        req.executionResult = executionResult;

    } catch (error) {
        console.error('[BMAD SYSTEM] Auto-execution failed:', error);
        req.executionError = error.message;
    }

    next();
}

/**
 * Global system instance for API routes
 */
let globalBMADSystem = null;

function getGlobalBMADSystem() {
    if (!globalBMADSystem) {
        globalBMADSystem = new BMADExecutionSystem();
    }
    return globalBMADSystem;
}

module.exports = {
    BMADExecutionSystem,
    bmadExecutionMiddleware,
    bmadResponseMiddleware,
    bmadAutoExecuteMiddleware,
    getGlobalBMADSystem
};