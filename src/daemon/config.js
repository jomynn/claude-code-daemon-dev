/**
 * Configuration Module
 * Loads and manages configuration based on environment
 */

const path = require('path');
const fs = require('fs');

class Config {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.config = this.loadConfig();
    }

    loadConfig() {
        const defaultConfig = {
            database: {
                path: './data/claude-daemon.db',
                backup: true
            },
            monitoring: {
                interval: 300, // 5 minutes in seconds
                warningThreshold: 80, // Percentage
                criticalThreshold: 95 // Percentage
            },
            logging: {
                level: 'info',
                file: './logs/daemon.log'
            },
            server: {
                port: 5000,
                cors: {
                    origin: '*'
                }
            },
            cleanup: {
                retentionDays: 30
            },
            notifications: {
                channels: ['console'],
                throttle: {
                    enabled: true,
                    windowMs: 900000, // 15 minutes
                    maxAlerts: 10
                }
            },
            predictions: {
                enabled: true,
                modelVersion: '1.0.0',
                minDataPoints: 10,
                updateInterval: 1800 // 30 minutes
            },
            bmad: {
                enabled: false,
                apiEndpoint: null,
                apiKey: null
            }
        };

        // Try to load environment-specific config
        const configPath = path.join(__dirname, '../../config', `${this.env}.json`);

        try {
            if (fs.existsSync(configPath)) {
                const envConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return this.mergeConfig(defaultConfig, envConfig);
            }
        } catch (error) {
            console.error(`Failed to load config file: ${configPath}`, error);
        }

        // Load from environment variables
        const envConfig = this.loadFromEnv();
        return this.mergeConfig(defaultConfig, envConfig);
    }

    loadFromEnv() {
        const config = {};

        if (process.env.DATABASE_PATH) {
            config.database = { path: process.env.DATABASE_PATH };
        }

        if (process.env.LOG_LEVEL) {
            config.logging = { level: process.env.LOG_LEVEL };
        }

        if (process.env.PORT) {
            config.server = { port: parseInt(process.env.PORT, 10) };
        }

        if (process.env.MONITORING_INTERVAL) {
            config.monitoring = { interval: parseInt(process.env.MONITORING_INTERVAL, 10) };
        }

        return config;
    }

    mergeConfig(defaultConfig, overrides) {
        const merged = JSON.parse(JSON.stringify(defaultConfig));

        for (const key in overrides) {
            if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
                merged[key] = { ...merged[key], ...overrides[key] };
            } else {
                merged[key] = overrides[key];
            }
        }

        return merged;
    }

    get(path) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            value = value[key];
            if (value === undefined) {
                return undefined;
            }
        }

        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        let obj = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!obj[key]) {
                obj[key] = {};
            }
            obj = obj[key];
        }

        obj[keys[keys.length - 1]] = value;
    }

    getAll() {
        return JSON.parse(JSON.stringify(this.config));
    }

    reload() {
        this.config = this.loadConfig();
    }

    validate() {
        const required = [
            'database.path',
            'monitoring.interval',
            'logging.level',
            'server.port'
        ];

        const errors = [];

        for (const path of required) {
            if (this.get(path) === undefined) {
                errors.push(`Missing required configuration: ${path}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }

        return true;
    }
}

// Export singleton instance with config properties exposed
const configInstance = new Config();

// Export the config properties directly for easier access
module.exports = configInstance.config;

// Also export the instance methods if needed
module.exports.get = (path) => configInstance.get(path);
module.exports.set = (path, value) => configInstance.set(path, value);
module.exports.getAll = () => configInstance.getAll();
module.exports.reload = () => configInstance.reload();
module.exports.validate = () => configInstance.validate();
