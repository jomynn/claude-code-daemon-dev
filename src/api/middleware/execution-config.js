/**
 * Execution Mode Configuration System
 * Provides configuration overrides to enforce execution behavior over PM responses
 */

const fs = require('fs').promises;
const path = require('path');

class ExecutionConfigManager {
    constructor() {
        this.defaultConfig = {
            execution: {
                enabled: true,
                autoDetect: true,
                forceMode: false, // If true, all requests become execution mode
                timeoutMs: 300000, // 5 minutes for execution
                maxConcurrentExecutions: 3,
                outputPath: './generated-projects',
                logLevel: 'info'
            },

            bmad: {
                detectionThreshold: 0.6, // Confidence threshold for BMAD detection
                requireExplicitTriggers: false, // If true, require specific execution keywords
                preserveOriginalPrompts: true, // Keep original prompts for debugging
                enableMetadataExtraction: true,
                enableAutoStructure: true
            },

            claude: {
                overridePlanningResponses: true,
                injectExecutionContext: true,
                suppressQuestions: true,
                enforceDirectOutput: true,
                enableResponseValidation: true,
                maxRetries: 2
            },

            responses: {
                // Patterns that trigger execution mode override
                planningPatterns: [
                    /let me help you plan/i,
                    /here's how i would approach/i,
                    /we should start by/i,
                    /before we begin/i,
                    /i recommend the following/i,
                    /timeline for this project/i,
                    /break this into phases/i,
                    /project management/i,
                    /scrum methodology/i,
                    /sprint planning/i
                ],

                // Response templates for different scenarios
                templates: {
                    bmadDetected: "🚀 BMAD document detected. Switching to execution mode and building your project immediately.",
                    executionStarted: "⚡ Execution mode activated. Creating project files and structure now.",
                    planningOverride: "🔧 Planning response intercepted. Building project instead of providing recommendations.",
                    executionComplete: "✅ Project build completed successfully. All files and configurations created.",
                    executionFailed: "❌ Project build encountered errors. Check logs for details."
                },

                // Blocked phrases that should never appear in execution mode
                blockedPhrases: [
                    "let me help you plan",
                    "project timeline",
                    "development phases",
                    "sprint methodology",
                    "stakeholder requirements",
                    "before we start",
                    "need more information",
                    "clarifying questions",
                    "project management approach",
                    "scrum framework"
                ]
            },

            validation: {
                enableResponseChecking: true,
                requireExecutionIndicators: true,
                blockPlanningLanguage: true,
                enforceFileCreation: false, // If true, responses must include actual file creation
                validateProjectStructure: true
            },

            logging: {
                enableDetectionLogs: true,
                enableExecutionLogs: true,
                enableOverrideLogs: true,
                enableValidationLogs: true,
                logPath: './logs/execution-mode.log'
            },

            notifications: {
                enableSlackNotifications: false,
                enableEmailNotifications: false,
                enableWebhooks: false,
                webhookUrl: null,
                channels: []
            }
        };

        this.activeConfig = { ...this.defaultConfig };
        this.configPath = path.join(__dirname, '../../../config/execution-mode.json');

        // Runtime state
        this.stats = {
            totalDetections: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            overriddenResponses: 0,
            startTime: new Date()
        };
    }

    /**
     * Load configuration from file or environment
     */
    async loadConfig() {
        try {
            // Try to load from file first
            const fileConfig = await this._loadFromFile();
            if (fileConfig) {
                this.activeConfig = this._mergeConfig(this.defaultConfig, fileConfig);
            }

            // Override with environment variables
            const envConfig = this._loadFromEnvironment();
            this.activeConfig = this._mergeConfig(this.activeConfig, envConfig);

            console.log('[EXECUTION CONFIG] Configuration loaded successfully');
            return this.activeConfig;

        } catch (error) {
            console.warn('[EXECUTION CONFIG] Failed to load config, using defaults:', error.message);
            return this.defaultConfig;
        }
    }

    /**
     * Save configuration to file
     */
    async saveConfig(config = null) {
        try {
            const configToSave = config || this.activeConfig;

            // Ensure config directory exists
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });

            await fs.writeFile(
                this.configPath,
                JSON.stringify(configToSave, null, 2)
            );

            console.log('[EXECUTION CONFIG] Configuration saved successfully');
            return true;

        } catch (error) {
            console.error('[EXECUTION CONFIG] Failed to save config:', error.message);
            return false;
        }
    }

    /**
     * Get configuration value by path
     */
    get(path) {
        const keys = path.split('.');
        let value = this.activeConfig;

        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) {
                return undefined;
            }
        }

        return value;
    }

    /**
     * Set configuration value by path
     */
    set(path, value) {
        const keys = path.split('.');
        let obj = this.activeConfig;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!obj[key] || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            obj = obj[key];
        }

        obj[keys[keys.length - 1]] = value;
    }

    /**
     * Update statistics
     */
    updateStats(type, increment = 1) {
        if (this.stats[type] !== undefined) {
            this.stats[type] += increment;
        }
    }

    /**
     * Get current statistics
     */
    getStats() {
        const runtime = Math.floor((new Date() - this.stats.startTime) / 1000);

        return {
            ...this.stats,
            runtime_seconds: runtime,
            success_rate: this.stats.totalDetections > 0
                ? (this.stats.successfulExecutions / this.stats.totalDetections * 100).toFixed(1)
                : 0
        };
    }

    /**
     * Validate execution mode response
     */
    validateExecutionResponse(response) {
        const validation = {
            isValid: true,
            issues: [],
            score: 100
        };

        if (!response || typeof response !== 'string') {
            validation.isValid = false;
            validation.issues.push('Response is empty or invalid');
            return validation;
        }

        const responseLower = response.toLowerCase();

        // Check for blocked phrases
        const blockedPhrases = this.get('responses.blockedPhrases') || [];
        for (const phrase of blockedPhrases) {
            if (responseLower.includes(phrase.toLowerCase())) {
                validation.isValid = false;
                validation.issues.push(`Contains blocked phrase: "${phrase}"`);
                validation.score -= 20;
            }
        }

        // Check for planning patterns
        const planningPatterns = this.get('responses.planningPatterns') || [];
        for (const pattern of planningPatterns) {
            if (pattern.test(response)) {
                validation.isValid = false;
                validation.issues.push(`Contains planning pattern: ${pattern.toString()}`);
                validation.score -= 25;
            }
        }

        // Check for execution indicators
        const executionIndicators = ['creating', 'building', 'implementing', 'installing', 'configuring'];
        const hasExecutionIndicators = executionIndicators.some(indicator =>
            responseLower.includes(indicator)
        );

        if (!hasExecutionIndicators && this.get('validation.requireExecutionIndicators')) {
            validation.issues.push('Missing execution action indicators');
            validation.score -= 15;
        }

        // Check for file creation evidence
        const fileCreationIndicators = ['file created', 'directory created', 'installed', 'generated'];
        const hasFileCreation = fileCreationIndicators.some(indicator =>
            responseLower.includes(indicator)
        );

        if (!hasFileCreation && this.get('validation.enforceFileCreation')) {
            validation.issues.push('No evidence of actual file/directory creation');
            validation.score -= 30;
        }

        validation.score = Math.max(0, validation.score);

        return validation;
    }

    /**
     * Get response template
     */
    getResponseTemplate(templateName) {
        return this.get(`responses.templates.${templateName}`) ||
               `Execution mode response for: ${templateName}`;
    }

    /**
     * Check if execution mode should be forced
     */
    shouldForceExecutionMode() {
        return this.get('execution.forceMode') === true;
    }

    /**
     * Check if BMAD auto-detection is enabled
     */
    isBMADDetectionEnabled() {
        return this.get('bmad.autoDetect') !== false;
    }

    /**
     * Get BMAD detection threshold
     */
    getBMADThreshold() {
        return this.get('bmad.detectionThreshold') || 0.6;
    }

    /**
     * Enable/disable execution mode
     */
    setExecutionMode(enabled) {
        this.set('execution.enabled', enabled);
    }

    /**
     * Private helper methods
     */

    async _loadFromFile() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            return null;
        }
    }

    _loadFromEnvironment() {
        const envConfig = {};

        // Execution settings
        if (process.env.EXECUTION_MODE_ENABLED !== undefined) {
            envConfig.execution = envConfig.execution || {};
            envConfig.execution.enabled = process.env.EXECUTION_MODE_ENABLED === 'true';
        }

        if (process.env.EXECUTION_FORCE_MODE !== undefined) {
            envConfig.execution = envConfig.execution || {};
            envConfig.execution.forceMode = process.env.EXECUTION_FORCE_MODE === 'true';
        }

        if (process.env.BMAD_DETECTION_THRESHOLD) {
            envConfig.bmad = envConfig.bmad || {};
            envConfig.bmad.detectionThreshold = parseFloat(process.env.BMAD_DETECTION_THRESHOLD);
        }

        if (process.env.EXECUTION_OUTPUT_PATH) {
            envConfig.execution = envConfig.execution || {};
            envConfig.execution.outputPath = process.env.EXECUTION_OUTPUT_PATH;
        }

        return envConfig;
    }

    _mergeConfig(base, override) {
        const merged = JSON.parse(JSON.stringify(base));

        for (const key in override) {
            if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
                merged[key] = this._mergeConfig(merged[key] || {}, override[key]);
            } else {
                merged[key] = override[key];
            }
        }

        return merged;
    }
}

/**
 * Express middleware for execution configuration
 */
function executionConfigMiddleware(req, res, next) {
    const configManager = new ExecutionConfigManager();

    // Add config manager to request
    req.executionConfig = configManager;

    // Load configuration if not already loaded
    if (!req.app.locals.executionConfig) {
        configManager.loadConfig().then(config => {
            req.app.locals.executionConfig = config;
        }).catch(error => {
            console.warn('[EXECUTION CONFIG] Failed to load config in middleware:', error.message);
        });
    }

    // Override execution mode if forced
    if (configManager.shouldForceExecutionMode()) {
        req.executionMode = true;
        req.forcedExecutionMode = true;
    }

    next();
}

/**
 * Global configuration singleton
 */
let globalConfigManager = null;

function getGlobalConfigManager() {
    if (!globalConfigManager) {
        globalConfigManager = new ExecutionConfigManager();
        globalConfigManager.loadConfig().catch(error => {
            console.warn('[EXECUTION CONFIG] Failed to load global config:', error.message);
        });
    }
    return globalConfigManager;
}

module.exports = {
    ExecutionConfigManager,
    executionConfigMiddleware,
    getGlobalConfigManager
};