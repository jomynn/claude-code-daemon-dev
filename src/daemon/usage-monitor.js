/**
 * Usage Monitor Module
 * Tracks Claude Code usage and generates predictions
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

class UsageMonitor extends EventEmitter {
    constructor() {
        super();
        this.db = null;
        this.isRunning = false;
        this.currentUsage = {
            tokens: 0,
            requests: 0,
            tokensPerHour: 0,
            requestsPerHour: 0
        };
        this.usageHistory = [];
        this.predictions = null;
    }

    async initialize() {
        try {
            await this.initializeDatabase();
            await this.loadHistoricalData();
            this.isRunning = true;
        } catch (error) {
            throw new Error(`Failed to initialize usage monitor: ${error.message}`);
        }
    }

    async initializeDatabase() {
        const dbPath = process.env.DATABASE_PATH || './data/claude-daemon.db';
        const dbDir = path.dirname(dbPath);

        // Ensure database directory exists
        await fs.mkdir(dbDir, { recursive: true });

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Create tables if they don't exist
                this.db.serialize(() => {
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS usage_data (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            tokens INTEGER,
                            requests INTEGER,
                            tokens_per_hour REAL,
                            requests_per_hour REAL,
                            metadata TEXT
                        )
                    `);

                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS predictions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            predicted_limit_time DATETIME,
                            hours_remaining REAL,
                            confidence REAL,
                            model_version TEXT
                        )
                    `);

                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS alerts (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            type TEXT,
                            severity TEXT,
                            message TEXT,
                            resolved BOOLEAN DEFAULT 0,
                            resolved_at DATETIME
                        )
                    `);

                    resolve();
                });
            });
        });
    }

    async loadHistoricalData() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM usage_data
                ORDER BY timestamp DESC
                LIMIT 1000
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.usageHistory = rows || [];
                resolve();
            });
        });
    }

    async start() {
        if (!this.isRunning) {
            this.isRunning = true;
            await this.collectUsageData();
        }
    }

    async stop() {
        this.isRunning = false;
        if (this.db) {
            await new Promise((resolve) => {
                this.db.close(() => resolve());
            });
        }
    }

    async collectUsageData() {
        try {
            // Get Claude Code usage data
            const usageData = await this.getClaudeUsage();

            // Calculate rates
            const now = Date.now();
            const hourAgo = now - (60 * 60 * 1000);
            const recentData = this.usageHistory.filter(d =>
                new Date(d.timestamp).getTime() > hourAgo
            );

            const tokensPerHour = recentData.reduce((sum, d) => sum + d.tokens, 0);
            const requestsPerHour = recentData.reduce((sum, d) => sum + d.requests, 0);

            this.currentUsage = {
                tokens: usageData.tokens,
                requests: usageData.requests,
                tokensPerHour,
                requestsPerHour,
                timestamp: new Date().toISOString()
            };

            // Store in database
            await this.storeUsageData(this.currentUsage);

            // Check thresholds
            await this.checkUsageThresholds();

            // Emit update event
            this.emit('usage-update', this.currentUsage);

        } catch (error) {
            console.error('Failed to collect usage data:', error);
        }
    }

    async getClaudeUsage() {
        try {
            // Execute claude command to get usage
            const { stdout } = await execPromise('claude usage --json 2>/dev/null || echo "{}"');

            try {
                const data = JSON.parse(stdout);
                return {
                    tokens: data.tokens_used || 0,
                    requests: data.requests_made || 0,
                    limit: data.token_limit || 1000000,
                    remaining: data.tokens_remaining || 1000000
                };
            } catch {
                // If JSON parsing fails, try alternative methods
                return await this.getUsageFromLogs();
            }
        } catch (error) {
            console.error('Failed to get Claude usage:', error);
            return {
                tokens: 0,
                requests: 0,
                limit: 1000000,
                remaining: 1000000
            };
        }
    }

    async getUsageFromLogs() {
        // Parse Claude Code logs for usage information
        try {
            const logPath = path.join(process.env.HOME, '.claude', 'logs', 'usage.log');
            const logContent = await fs.readFile(logPath, 'utf8');
            const lines = logContent.split('\n').filter(Boolean);

            if (lines.length > 0) {
                const lastLine = lines[lines.length - 1];
                const match = lastLine.match(/tokens:(\d+)\s+requests:(\d+)/);

                if (match) {
                    return {
                        tokens: parseInt(match[1], 10),
                        requests: parseInt(match[2], 10),
                        limit: 1000000,
                        remaining: 1000000 - parseInt(match[1], 10)
                    };
                }
            }
        } catch (error) {
            // Log file might not exist
        }

        return {
            tokens: 0,
            requests: 0,
            limit: 1000000,
            remaining: 1000000
        };
    }

    async storeUsageData(data) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO usage_data (tokens, requests, tokens_per_hour, requests_per_hour, metadata)
                VALUES (?, ?, ?, ?, ?)
            `;

            const metadata = JSON.stringify({
                timestamp: data.timestamp,
                source: 'automatic'
            });

            this.db.run(query, [
                data.tokens,
                data.requests,
                data.tokensPerHour,
                data.requestsPerHour,
                metadata
            ], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    async checkUsageThresholds() {
        const usage = await this.getClaudeUsage();
        const percentageUsed = (usage.tokens / usage.limit) * 100;

        if (percentageUsed > 80) {
            this.emit('limit-warning', {
                percentage: percentageUsed,
                tokens: usage.tokens,
                limit: usage.limit,
                remaining: usage.remaining
            });
        }

        if (percentageUsed > 95) {
            this.emit('limit-critical', {
                percentage: percentageUsed,
                tokens: usage.tokens,
                limit: usage.limit,
                remaining: usage.remaining
            });
        }
    }

    async updatePredictions() {
        try {
            const recentData = await this.getRecentUsageData(24); // Last 24 hours

            if (recentData.length < 10) {
                // Not enough data for predictions
                return;
            }

            // Simple linear regression for prediction
            const prediction = this.calculateUsagePrediction(recentData);

            this.predictions = prediction;

            // Store prediction
            await this.storePrediction(prediction);

            // Emit prediction update
            this.emit('prediction-update', prediction);

        } catch (error) {
            console.error('Failed to update predictions:', error);
        }
    }

    calculateUsagePrediction(data) {
        // Calculate average rate of token usage
        const rates = data.map(d => d.tokens_per_hour || 0);
        const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;

        // Get current usage
        const currentUsage = data[0].tokens || 0;
        const limit = 1000000; // Default limit

        // Calculate hours remaining
        const tokensRemaining = limit - currentUsage;
        const hoursRemaining = avgRate > 0 ? tokensRemaining / avgRate : Infinity;

        // Calculate predicted time
        const predictedTime = new Date(Date.now() + (hoursRemaining * 60 * 60 * 1000));

        return {
            hoursRemaining,
            predictedLimitTime: predictedTime.toISOString(),
            averageRate: avgRate,
            confidence: this.calculateConfidence(data),
            modelVersion: '1.0.0'
        };
    }

    calculateConfidence(data) {
        // Simple confidence calculation based on data consistency
        if (data.length < 10) {return 0.3;}

        const rates = data.map(d => d.tokens_per_hour || 0);
        const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
        const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
        const stdDev = Math.sqrt(variance);

        // Lower std deviation = higher confidence
        const cv = mean > 0 ? stdDev / mean : 1;
        const confidence = Math.max(0.3, Math.min(0.95, 1 - cv));

        return confidence;
    }

    async storePrediction(prediction) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO predictions (predicted_limit_time, hours_remaining, confidence, model_version)
                VALUES (?, ?, ?, ?)
            `;

            this.db.run(query, [
                prediction.predictedLimitTime,
                prediction.hoursRemaining,
                prediction.confidence,
                prediction.modelVersion
            ], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    async getRecentUsageData(hours = 24) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM usage_data
                WHERE timestamp > datetime('now', '-${hours} hours')
                ORDER BY timestamp DESC
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows || []);
            });
        });
    }

    async cleanupOldData(retentionDays = 30) {
        return new Promise((resolve, reject) => {
            const query = `
                DELETE FROM usage_data
                WHERE timestamp < datetime('now', '-${retentionDays} days')
            `;

            this.db.run(query, [], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    async optimizeDatabase() {
        return new Promise((resolve, reject) => {
            this.db.run('VACUUM', [], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    async checkClaudeStatus() {
        try {
            const { stdout } = await execPromise('claude --version 2>/dev/null');
            return {
                healthy: true,
                version: stdout.trim()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    async checkDatabaseHealth() {
        return new Promise((resolve) => {
            this.db.get('SELECT COUNT(*) as count FROM usage_data', [], (err, row) => {
                if (err) {
                    resolve({
                        healthy: false,
                        error: err.message
                    });
                    return;
                }

                resolve({
                    healthy: true,
                    recordCount: row.count
                });
            });
        });
    }

    async getCurrentUsage() {
        return this.currentUsage;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            currentUsage: this.currentUsage,
            predictions: this.predictions,
            historySize: this.usageHistory.length
        };
    }
}

module.exports = UsageMonitor;
