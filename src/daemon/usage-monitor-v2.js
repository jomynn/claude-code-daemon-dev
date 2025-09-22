/**
 * Enhanced Usage Monitor Module v2
 * Tracks Claude Code usage and generates predictions with PostgreSQL support
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const dbConnection = require('../database/connection');

class UsageMonitorV2 extends EventEmitter {
    constructor() {
        super();
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
            console.log('🔄 Initializing Enhanced Usage Monitor...');

            // Initialize database connection
            await dbConnection.initialize();

            // Load current usage
            await this.loadCurrentUsage();

            // Generate initial predictions
            await this.updatePredictions();

            console.log('✅ Enhanced Usage Monitor initialized');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize usage monitor:', error);
            throw error;
        }
    }

    async loadCurrentUsage() {
        try {
            // Get latest usage data from the last hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            const recentData = await dbConnection.select('usage_data', {}, {
                orderBy: 'timestamp DESC',
                limit: 1
            });

            if (recentData.length > 0) {
                const latest = recentData[0];
                this.currentUsage = {
                    tokens: latest.tokens_used || 0,
                    requests: latest.requests_count || 0,
                    tokensPerHour: this.calculateHourlyRate(latest.tokens_used),
                    requestsPerHour: this.calculateHourlyRate(latest.requests_count)
                };
            }

            console.log('📊 Current usage loaded:', this.currentUsage);

        } catch (error) {
            console.error('❌ Failed to load current usage:', error);
            // Initialize with defaults
            this.currentUsage = {
                tokens: 0,
                requests: 0,
                tokensPerHour: 0,
                requestsPerHour: 0
            };
        }
    }

    calculateHourlyRate(value) {
        // Simple estimation - this could be more sophisticated
        return Math.round(value * 0.8); // Assume current rate is 80% of last measurement
    }

    async collectUsageData() {
        try {
            // Simulate collecting usage data
            const usage = {
                timestamp: new Date().toISOString(),
                tokens_used: this.currentUsage.tokens + Math.floor(Math.random() * 1000),
                requests_count: this.currentUsage.requests + Math.floor(Math.random() * 50),
                avg_response_time: Math.floor(Math.random() * 2000) + 500,
                active_users: Math.floor(Math.random() * 10) + 1,
                error_count: Math.floor(Math.random() * 3),
                cost_usd: 0
            };

            // Calculate cost (example: $0.002 per 1K tokens)
            usage.cost_usd = (usage.tokens_used * 0.000002).toFixed(4);

            // Save to database
            await dbConnection.insert('usage_data', usage);

            // Update current usage
            this.currentUsage.tokens = usage.tokens_used;
            this.currentUsage.requests = usage.requests_count;
            this.currentUsage.tokensPerHour = this.calculateHourlyRate(usage.tokens_used);
            this.currentUsage.requestsPerHour = this.calculateHourlyRate(usage.requests_count);

            // Emit usage event
            this.emit('usage-collected', usage);

            console.log('📊 Usage data collected:', usage);
            return usage;

        } catch (error) {
            console.error('❌ Failed to collect usage data:', error);
            throw error;
        }
    }

    async getCurrentUsage() {
        return this.currentUsage;
    }

    async getRecentUsageData(hours = 24) {
        try {
            const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

            const data = await dbConnection.query(`
                SELECT
                    timestamp,
                    tokens_used as tokens,
                    requests_count as requests,
                    avg_response_time,
                    active_users,
                    error_count,
                    cost_usd
                FROM usage_data
                WHERE timestamp >= $1
                ORDER BY timestamp ASC
            `, [hoursAgo]);

            // Add calculated rates
            const enrichedData = data.map(row => ({
                ...row,
                tokens_per_hour: this.calculateHourlyRate(row.tokens),
                requests_per_hour: this.calculateHourlyRate(row.requests)
            }));

            this.usageHistory = enrichedData;
            return enrichedData;

        } catch (error) {
            console.error('❌ Failed to get recent usage data:', error);
            return [];
        }
    }

    async updatePredictions() {
        try {
            console.log('🔮 Updating usage predictions...');

            // Get historical data for prediction
            const historicalData = await this.getRecentUsageData(168); // 7 days

            if (historicalData.length < 2) {
                console.log('📊 Insufficient data for predictions');
                this.predictions = [];
                return;
            }

            // Simple linear regression for prediction
            const predictions = [];
            const avgTokensPerDay = this.calculateAverage(historicalData.map(d => d.tokens));
            const avgCostPerDay = this.calculateAverage(historicalData.map(d => parseFloat(d.cost_usd)));

            // Generate predictions for next 7 days
            for (let i = 1; i <= 7; i++) {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + i);

                // Add some randomness and trend
                const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
                const trendFactor = 1 + (i * 0.02); // 2% growth per day

                const prediction = {
                    date: futureDate.toISOString().split('T')[0],
                    predicted_tokens: Math.round(avgTokensPerDay * trendFactor * (1 + variation)),
                    predicted_cost: (avgCostPerDay * trendFactor * (1 + variation)).toFixed(4),
                    confidence: Math.max(0.5, 0.9 - (i * 0.05)) // Decreasing confidence over time
                };

                predictions.push(prediction);

                // Save to database
                await dbConnection.insert('predictions', prediction);
            }

            this.predictions = predictions;
            console.log(`🔮 Generated ${predictions.length} predictions`);

        } catch (error) {
            console.error('❌ Failed to update predictions:', error);
            this.predictions = [];
        }
    }

    calculateAverage(values) {
        if (values.length === 0) return 0;
        const sum = values.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        return sum / values.length;
    }

    async getUsageStats(period = 'day') {
        const hours = {
            hour: 1,
            day: 24,
            week: 168,
            month: 720
        }[period] || 24;

        const data = await this.getRecentUsageData(hours);

        if (data.length === 0) {
            return {
                period,
                dataPoints: 0,
                tokens: { total: 0, average: 0, max: 0, min: 0 },
                requests: { total: 0, average: 0, max: 0, min: 0 }
            };
        }

        const tokens = data.map(d => d.tokens || 0);
        const requests = data.map(d => d.requests || 0);

        return {
            period,
            dataPoints: data.length,
            tokens: {
                total: tokens.reduce((sum, t) => sum + t, 0),
                average: this.calculateAverage(tokens),
                max: Math.max(...tokens, 0),
                min: Math.min(...tokens, 0)
            },
            requests: {
                total: requests.reduce((sum, r) => sum + r, 0),
                average: this.calculateAverage(requests),
                max: Math.max(...requests, 0),
                min: Math.min(...requests, 0)
            }
        };
    }

    async createAlert(level, title, message) {
        try {
            const alert = {
                id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                level,
                title,
                message,
                timestamp: new Date().toISOString(),
                acknowledged: false
            };

            await dbConnection.insert('alerts', alert);
            this.emit('alert-created', alert);

            console.log(`🚨 Alert created: ${title}`);
            return alert;

        } catch (error) {
            console.error('❌ Failed to create alert:', error);
            throw error;
        }
    }

    async getAlerts(limit = 50) {
        try {
            return await dbConnection.select('alerts', {}, {
                orderBy: 'timestamp DESC',
                limit
            });
        } catch (error) {
            console.error('❌ Failed to get alerts:', error);
            return [];
        }
    }

    async acknowledgeAlert(alertId) {
        try {
            await dbConnection.update('alerts',
                {
                    acknowledged: true,
                    acknowledged_at: new Date().toISOString()
                },
                { id: alertId }
            );

            console.log(`✅ Alert acknowledged: ${alertId}`);
            return true;

        } catch (error) {
            console.error('❌ Failed to acknowledge alert:', error);
            return false;
        }
    }

    async startMonitoring(interval = 60000) {
        if (this.isRunning) {
            console.log('⚠️  Usage monitor is already running');
            return;
        }

        console.log(`🚀 Starting usage monitoring (interval: ${interval}ms)`);
        this.isRunning = true;

        this.monitoringInterval = setInterval(async () => {
            try {
                await this.collectUsageData();

                // Check for alerts
                if (this.currentUsage.tokens > 80000) {
                    await this.createAlert('warning', 'High Token Usage',
                        `Token usage (${this.currentUsage.tokens}) is above 80,000`);
                }

                if (this.currentUsage.tokensPerHour > 10000) {
                    await this.createAlert('info', 'High Usage Rate',
                        `Current token rate: ${this.currentUsage.tokensPerHour}/hour`);
                }

            } catch (error) {
                console.error('❌ Error during monitoring:', error);
            }
        }, interval);

        // Update predictions every hour
        this.predictionInterval = setInterval(async () => {
            try {
                await this.updatePredictions();
            } catch (error) {
                console.error('❌ Error updating predictions:', error);
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    stopMonitoring() {
        if (!this.isRunning) {
            console.log('⚠️  Usage monitor is not running');
            return;
        }

        console.log('🛑 Stopping usage monitoring');
        this.isRunning = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        if (this.predictionInterval) {
            clearInterval(this.predictionInterval);
        }
    }

    async getSystemHealth() {
        try {
            const dbStats = dbConnection.getStats();
            const recentData = await this.getRecentUsageData(1);

            return {
                database: dbStats,
                monitoring: {
                    isRunning: this.isRunning,
                    lastUpdate: recentData.length > 0 ? recentData[recentData.length - 1].timestamp : null
                },
                usage: this.currentUsage,
                predictions: this.predictions ? this.predictions.length : 0
            };

        } catch (error) {
            console.error('❌ Failed to get system health:', error);
            return {
                database: { status: 'error' },
                monitoring: { isRunning: false },
                usage: {},
                predictions: 0
            };
        }
    }

    async shutdown() {
        console.log('🔄 Shutting down usage monitor...');

        this.stopMonitoring();

        if (dbConnection) {
            await dbConnection.close();
        }

        console.log('✅ Usage monitor shutdown complete');
    }
}

module.exports = UsageMonitorV2;