#!/usr/bin/env node

/**
 * Claude Code Daemon Manager
 * Main orchestrator for the daemon system
 */

const EventEmitter = require('events');
const cron = require('cron');
const winston = require('winston');
const config = require('./config');
const UsageMonitor = require('./usage-monitor');
const NotificationService = require('./notification-service');

class DaemonManager extends EventEmitter {
    constructor() {
        super();
        this.logger = winston.createLogger({
            level: config.logging.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/daemon.log' }),
                new winston.transports.Console()
            ]
        });

        this.usageMonitor = new UsageMonitor();
        this.notificationService = new NotificationService();
        this.isRunning = false;
        this.jobs = new Map();

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.usageMonitor.on('usage-update', (data) => {
            this.handleUsageUpdate(data);
        });

        this.usageMonitor.on('limit-warning', (data) => {
            this.handleLimitWarning(data);
        });

        this.usageMonitor.on('prediction-update', (data) => {
            this.handlePredictionUpdate(data);
        });

        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Daemon is already running');
            return;
        }

        try {
            this.logger.info('Starting Claude Code Daemon Manager');

            // Initialize services
            await this.usageMonitor.initialize();
            await this.notificationService.initialize();

            // Schedule recurring tasks
            this.scheduleJobs();

            // Start monitoring
            await this.usageMonitor.start();

            this.isRunning = true;
            this.logger.info('Daemon Manager started successfully');

            // Keep the process running
            this.keepAlive();

        } catch (error) {
            this.logger.error('Failed to start daemon:', error);
            process.exit(1);
        }
    }

    scheduleJobs() {
        // Usage monitoring every 5 minutes
        const usageJob = new cron.CronJob('*/5 * * * *', async () => {
            try {
                await this.usageMonitor.collectUsageData();
            } catch (error) {
                this.logger.error('Usage collection failed:', error);
            }
        });

        // Prediction updates every 30 minutes
        const predictionJob = new cron.CronJob('*/30 * * * *', async () => {
            try {
                await this.usageMonitor.updatePredictions();
            } catch (error) {
                this.logger.error('Prediction update failed:', error);
            }
        });

        // Daily cleanup at 2 AM
        const cleanupJob = new cron.CronJob('0 2 * * *', async () => {
            try {
                await this.performCleanup();
            } catch (error) {
                this.logger.error('Cleanup failed:', error);
            }
        });

        // Health check every minute
        const healthJob = new cron.CronJob('* * * * *', async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.logger.error('Health check failed:', error);
            }
        });

        this.jobs.set('usage', usageJob);
        this.jobs.set('prediction', predictionJob);
        this.jobs.set('cleanup', cleanupJob);
        this.jobs.set('health', healthJob);

        // Start all jobs
        this.jobs.forEach(job => job.start());

        this.logger.info('Scheduled jobs initialized');
    }

    async handleUsageUpdate(data) {
        this.logger.debug('Usage update received:', data);
        this.emit('usage-data', data);

        // Check for concerning patterns
        if (data.tokensPerHour > config.monitoring.warningThreshold) {
            await this.notificationService.sendAlert({
                type: 'usage-warning',
                message: `High token usage detected: ${data.tokensPerHour} tokens/hour`,
                severity: 'warning',
                data
            });
        }
    }

    async handleLimitWarning(data) {
        this.logger.warn('Usage limit warning:', data);

        await this.notificationService.sendAlert({
            type: 'limit-warning',
            message: `Approaching usage limit: ${data.percentage}% of limit reached`,
            severity: 'critical',
            data
        });
    }

    async handlePredictionUpdate(data) {
        this.logger.debug('Prediction update:', data);

        if (data.hoursRemaining < 2) {
            await this.notificationService.sendAlert({
                type: 'limit-prediction',
                message: `Usage limit predicted in ${data.hoursRemaining.toFixed(1)} hours`,
                severity: 'warning',
                data
            });
        }
    }

    async performCleanup() {
        this.logger.info('Performing daily cleanup');

        try {
            // Clean old logs
            await this.usageMonitor.cleanupOldData(config.cleanup.retentionDays);

            // Optimize database
            await this.usageMonitor.optimizeDatabase();

            // Clear temporary files
            await this.clearTempFiles();

            this.logger.info('Cleanup completed successfully');

        } catch (error) {
            this.logger.error('Cleanup failed:', error);
        }
    }

    async performHealthCheck() {
        try {
            // Check Claude Code availability
            const claudeStatus = await this.usageMonitor.checkClaudeStatus();

            // Check database connectivity
            const dbStatus = await this.usageMonitor.checkDatabaseHealth();

            // Check system resources
            const systemStatus = this.getSystemStatus();

            const healthData = {
                claude: claudeStatus,
                database: dbStatus,
                system: systemStatus,
                timestamp: new Date().toISOString()
            };

            this.emit('health-check', healthData);

            // Log any issues
            if (!claudeStatus.healthy || !dbStatus.healthy || !systemStatus.healthy) {
                this.logger.warn('Health check issues detected:', healthData);
            }

        } catch (error) {
            this.logger.error('Health check failed:', error);
        }
    }

    getSystemStatus() {
        const usage = process.memoryUsage();
        const uptime = process.uptime();

        return {
            healthy: true,
            memory: {
                rss: usage.rss,
                heapTotal: usage.heapTotal,
                heapUsed: usage.heapUsed,
                external: usage.external
            },
            uptime,
            pid: process.pid
        };
    }

    async clearTempFiles() {
        // Implementation for clearing temporary files
        const fs = require('fs').promises;
        const path = require('path');

        const tempDir = path.join(__dirname, '../../temp');

        try {
            const files = await fs.readdir(tempDir);
            const oldFiles = files.filter(file => {
                const filePath = path.join(tempDir, file);
                const stats = require('fs').statSync(filePath);
                const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                return daysSinceModified > 7;
            });

            for (const file of oldFiles) {
                await fs.unlink(path.join(tempDir, file));
            }

            this.logger.debug(`Cleared ${oldFiles.length} temporary files`);

        } catch (error) {
            this.logger.debug('No temp directory or files to clean');
        }
    }

    keepAlive() {
        // Keep the process running
        setInterval(() => {
            if (!this.isRunning) {
                this.logger.info('Daemon stopped, exiting');
                process.exit(0);
            }
        }, 1000);
    }

    async shutdown() {
        this.logger.info('Shutting down daemon manager');
        this.isRunning = false;

        try {
            // Stop all cron jobs
            this.jobs.forEach(job => job.stop());

            // Stop services
            await this.usageMonitor.stop();
            await this.notificationService.cleanup();

            this.logger.info('Daemon manager shutdown complete');

        } catch (error) {
            this.logger.error('Error during shutdown:', error);
        }

        process.exit(0);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            startTime: this.startTime,
            uptime: process.uptime(),
            jobs: Array.from(this.jobs.keys()).map(name => ({
                name,
                running: this.jobs.get(name).running
            })),
            services: {
                usageMonitor: this.usageMonitor.getStatus(),
                notifications: this.notificationService.getStatus()
            }
        };
    }
}

// CLI entry point
if (require.main === module) {
    const daemon = new DaemonManager();

    // Handle command line arguments
    const args = process.argv.slice(2);

    switch (args[0]) {
        case 'start':
            daemon.start();
            break;
        case 'status':
            console.log(JSON.stringify(daemon.getStatus(), null, 2));
            break;
        default:
            console.log('Usage: node manager.js [start|status]');
            process.exit(1);
    }
}

module.exports = DaemonManager;
