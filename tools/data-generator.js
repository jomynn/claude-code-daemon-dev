#!/usr/bin/env node

/**
 * Data Generator Tool
 * Generates sample data for development and testing
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './data/claude-daemon.db';

class DataGenerator {
    constructor() {
        this.db = null;
    }

    async initialize() {
        // Ensure database directory exists
        const dbDir = path.dirname(DATABASE_PATH);
        await fs.mkdir(dbDir, { recursive: true });

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DATABASE_PATH, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log('✅ Connected to database for data generation');
                resolve();
            });
        });
    }

    async clearExistingData() {
        console.log('🧹 Clearing existing sample data...');

        const tables = [
            'usage_data',
            'predictions',
            'alerts',
            'system_metrics',
            'bmad_workflows'
        ];

        for (const table of tables) {
            await new Promise((resolve, reject) => {
                this.db.run(`DELETE FROM ${table}`, (err) => {
                    if (err) {
                        console.log(`⚠️  Table ${table} doesn't exist yet, skipping`);
                    }
                    resolve();
                });
            });
        }

        console.log('✅ Existing data cleared');
    }

    async generateUsageData() {
        console.log('📊 Generating usage data...');

        const records = [];
        const now = new Date();

        // Generate 7 days of hourly data
        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const timestamp = new Date(now.getTime() - (day * 24 + hour) * 60 * 60 * 1000);

                // Simulate realistic usage patterns
                const baseUsage = Math.sin((hour / 24) * Math.PI * 2) * 50 + 100; // Sinusoidal pattern
                const randomVariation = (Math.random() - 0.5) * 40;
                const weekendReduction = (timestamp.getDay() === 0 || timestamp.getDay() === 6) ? 0.7 : 1;

                const tokens = Math.max(0, Math.floor((baseUsage + randomVariation) * weekendReduction * (7 - day)));
                const requests = Math.max(0, Math.floor(tokens / 50 + Math.random() * 5));
                const tokensPerHour = Math.max(0, tokens + Math.random() * 20 - 10);
                const requestsPerHour = Math.max(0, requests + Math.random() * 2 - 1);

                records.push({
                    timestamp: timestamp.toISOString(),
                    tokens,
                    requests,
                    tokensPerHour,
                    requestsPerHour,
                    metadata: JSON.stringify({
                        source: 'generated',
                        dayOfWeek: timestamp.getDay(),
                        hour: timestamp.getHours()
                    })
                });
            }
        }

        // Insert records in batches
        const batchSize = 50;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            await this.insertUsageBatch(batch);
        }

        console.log(`✅ Generated ${records.length} usage records`);
    }

    async insertUsageBatch(records) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO usage_data (timestamp, tokens, requests, tokens_per_hour, requests_per_hour, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            this.db.serialize(() => {
                const stmt = this.db.prepare(sql);

                records.forEach(record => {
                    stmt.run([
                        record.timestamp,
                        record.tokens,
                        record.requests,
                        record.tokensPerHour,
                        record.requestsPerHour,
                        record.metadata
                    ]);
                });

                stmt.finalize((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        });
    }

    async generatePredictions() {
        console.log('🔮 Generating predictions...');

        const predictions = [];
        const now = new Date();

        // Generate predictions for next 24 hours
        for (let hour = 1; hour <= 24; hour++) {
            const predictedTime = new Date(now.getTime() + hour * 60 * 60 * 1000);
            const hoursRemaining = 24 - hour + Math.random() * 2;
            const confidence = 0.5 + Math.random() * 0.4; // 50-90% confidence

            predictions.push({
                timestamp: new Date(now.getTime() - hour * 60 * 60 * 1000).toISOString(),
                predicted_limit_time: predictedTime.toISOString(),
                hours_remaining: hoursRemaining,
                confidence: confidence,
                model_version: '1.0.0'
            });
        }

        const sql = `
            INSERT INTO predictions (timestamp, predicted_limit_time, hours_remaining, confidence, model_version)
            VALUES (?, ?, ?, ?, ?)
        `;

        for (const prediction of predictions) {
            await new Promise((resolve, reject) => {
                this.db.run(sql, [
                    prediction.timestamp,
                    prediction.predicted_limit_time,
                    prediction.hours_remaining,
                    prediction.confidence,
                    prediction.model_version
                ], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        }

        console.log(`✅ Generated ${predictions.length} predictions`);
    }

    async generateAlerts() {
        console.log('🚨 Generating alerts...');

        const alertTypes = [
            { type: 'usage-warning', severity: 'warning', message: 'High token usage detected' },
            { type: 'limit-warning', severity: 'critical', message: 'Approaching usage limit' },
            { type: 'prediction-update', severity: 'info', message: 'Usage predictions updated' },
            { type: 'system-health', severity: 'warning', message: 'System resource usage high' },
            { type: 'bmad-workflow', severity: 'info', message: 'BMAD workflow completed' }
        ];

        const alerts = [];
        const now = new Date();

        // Generate alerts for last 48 hours
        for (let i = 0; i < 25; i++) {
            const alertTemplate = alertTypes[Math.floor(Math.random() * alertTypes.length)];
            const timestamp = new Date(now.getTime() - Math.random() * 48 * 60 * 60 * 1000);

            alerts.push({
                timestamp: timestamp.toISOString(),
                type: alertTemplate.type,
                severity: alertTemplate.severity,
                message: alertTemplate.message,
                data: JSON.stringify({
                    generated: true,
                    value: Math.random() * 100,
                    threshold: 80
                }),
                resolved: Math.random() > 0.7 ? 1 : 0,
                resolved_at: Math.random() > 0.7 ? new Date(timestamp.getTime() + Math.random() * 2 * 60 * 60 * 1000).toISOString() : null
            });
        }

        const sql = `
            INSERT INTO alerts (timestamp, type, severity, message, data, resolved, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        for (const alert of alerts) {
            await new Promise((resolve, reject) => {
                this.db.run(sql, [
                    alert.timestamp,
                    alert.type,
                    alert.severity,
                    alert.message,
                    alert.data,
                    alert.resolved,
                    alert.resolved_at
                ], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        }

        console.log(`✅ Generated ${alerts.length} alerts`);
    }

    async generateSystemMetrics() {
        console.log('💻 Generating system metrics...');

        const metrics = [];
        const now = new Date();

        // Generate system metrics for last 24 hours (every 5 minutes)
        for (let i = 0; i < 24 * 12; i++) {
            const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);

            metrics.push({
                timestamp: timestamp.toISOString(),
                cpu_usage: Math.random() * 80 + 10, // 10-90%
                memory_usage: Math.random() * 60 + 30, // 30-90%
                disk_usage: Math.random() * 20 + 40, // 40-60%
                uptime: Math.floor(Math.random() * 7 * 24 * 60 * 60), // Up to 7 days
                connections: Math.floor(Math.random() * 20 + 1) // 1-20 connections
            });
        }

        const sql = `
            INSERT INTO system_metrics (timestamp, cpu_usage, memory_usage, disk_usage, uptime, connections)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const batchSize = 100;
        for (let i = 0; i < metrics.length; i += batchSize) {
            const batch = metrics.slice(i, i + batchSize);

            for (const metric of batch) {
                await new Promise((resolve, reject) => {
                    this.db.run(sql, [
                        metric.timestamp,
                        metric.cpu_usage,
                        metric.memory_usage,
                        metric.disk_usage,
                        metric.uptime,
                        metric.connections
                    ], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });
            }
        }

        console.log(`✅ Generated ${metrics.length} system metrics`);
    }

    async generateBmadWorkflows() {
        console.log('🔄 Generating BMAD workflows...');

        const workflowTypes = [
            'code-review',
            'feature-development',
            'bug-fix',
            'testing',
            'deployment'
        ];

        const statuses = ['pending', 'running', 'completed', 'failed'];
        const workflows = [];
        const now = new Date();

        for (let i = 0; i < 15; i++) {
            const workflowType = workflowTypes[Math.floor(Math.random() * workflowTypes.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const created = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

            let started = null;
            let completed = null;

            if (status !== 'pending') {
                started = new Date(created.getTime() + Math.random() * 60 * 60 * 1000);

                if (status === 'completed' || status === 'failed') {
                    completed = new Date(started.getTime() + Math.random() * 2 * 60 * 60 * 1000);
                }
            }

            workflows.push({
                workflow_id: `workflow-${Date.now()}-${i}`,
                name: `${workflowType}-${i + 1}`,
                status: status,
                created_at: created.toISOString(),
                started_at: started ? started.toISOString() : null,
                completed_at: completed ? completed.toISOString() : null,
                config: JSON.stringify({
                    type: workflowType,
                    priority: Math.floor(Math.random() * 3) + 1,
                    agents: ['dev', 'qa', 'pm'].slice(0, Math.floor(Math.random() * 3) + 1)
                }),
                results: status === 'completed' ? JSON.stringify({
                    success: true,
                    metrics: {
                        duration: Math.random() * 3600,
                        tasks_completed: Math.floor(Math.random() * 10) + 1
                    }
                }) : null
            });
        }

        const sql = `
            INSERT INTO bmad_workflows (workflow_id, name, status, created_at, started_at, completed_at, config, results)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const workflow of workflows) {
            await new Promise((resolve, reject) => {
                this.db.run(sql, [
                    workflow.workflow_id,
                    workflow.name,
                    workflow.status,
                    workflow.created_at,
                    workflow.started_at,
                    workflow.completed_at,
                    workflow.config,
                    workflow.results
                ], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        }

        console.log(`✅ Generated ${workflows.length} BMAD workflows`);
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('🔒 Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }

    async generateAll() {
        console.log('🎲 Generating comprehensive sample data...');

        await this.generateUsageData();
        await this.generatePredictions();
        await this.generateAlerts();
        await this.generateSystemMetrics();
        await this.generateBmadWorkflows();

        console.log('✅ All sample data generated successfully');
    }
}

// CLI functionality
async function main() {
    const command = process.argv[2] || 'all';
    const generator = new DataGenerator();

    try {
        await generator.initialize();

        switch (command) {
            case 'all':
                await generator.clearExistingData();
                await generator.generateAll();
                break;

            case 'usage':
                await generator.generateUsageData();
                break;

            case 'predictions':
                await generator.generatePredictions();
                break;

            case 'alerts':
                await generator.generateAlerts();
                break;

            case 'metrics':
                await generator.generateSystemMetrics();
                break;

            case 'workflows':
                await generator.generateBmadWorkflows();
                break;

            case 'clear':
                await generator.clearExistingData();
                console.log('✅ All data cleared');
                break;

            default:
                console.log('Usage: node data-generator.js [all|usage|predictions|alerts|metrics|workflows|clear]');
                process.exit(1);
        }

    } catch (error) {
        console.error('❌ Data generation failed:', error);
        process.exit(1);
    } finally {
        await generator.close();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = DataGenerator;