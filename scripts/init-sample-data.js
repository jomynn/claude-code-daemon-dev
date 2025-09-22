#!/usr/bin/env node

/**
 * Initialize Sample Data for Claude Code Daemon
 * Populates database with sample data for demonstration
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || '/data/claude-daemon.db';

console.log('🔄 Initializing sample data...');
console.log(`📍 Database path: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH);

// Sample usage data for the last 7 days
function generateUsageData() {
    const data = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Generate realistic usage patterns
        const baseHour = date.getHours();
        const tokensUsed = Math.floor(Math.random() * 5000) + 1000;
        const requestsCount = Math.floor(Math.random() * 100) + 20;
        const avgResponseTime = Math.floor(Math.random() * 2000) + 500;

        data.push({
            timestamp: date.toISOString(),
            tokens_used: tokensUsed,
            requests_count: requestsCount,
            avg_response_time: avgResponseTime,
            active_users: Math.floor(Math.random() * 10) + 1,
            error_count: Math.floor(Math.random() * 5),
            cost_usd: (tokensUsed * 0.000002).toFixed(4)
        });
    }

    return data;
}

// Sample alerts data
function generateAlertsData() {
    const alerts = [
        {
            id: 'alert_' + Date.now(),
            level: 'info',
            title: 'System Startup',
            message: 'Claude Code Daemon started successfully',
            timestamp: new Date().toISOString(),
            acknowledged: 0
        },
        {
            id: 'alert_' + (Date.now() + 1),
            level: 'success',
            title: 'Health Check Passed',
            message: 'All system components are functioning normally',
            timestamp: new Date(Date.now() - 300000).toISOString(),
            acknowledged: 0
        },
        {
            id: 'alert_' + (Date.now() + 2),
            level: 'warning',
            title: 'High Token Usage',
            message: 'Token usage is above 80% of daily limit',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            acknowledged: 0
        }
    ];

    return alerts;
}

// Initialize tables and data
async function initializeData() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create tables if they don't exist
            db.run(`
                CREATE TABLE IF NOT EXISTS usage_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    tokens_used INTEGER DEFAULT 0,
                    requests_count INTEGER DEFAULT 0,
                    avg_response_time INTEGER DEFAULT 0,
                    active_users INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    cost_usd REAL DEFAULT 0.0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    level TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT,
                    timestamp TEXT NOT NULL,
                    acknowledged INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    predicted_tokens INTEGER,
                    predicted_cost REAL,
                    confidence REAL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Clear existing data
            db.run(`DELETE FROM usage_data`);
            db.run(`DELETE FROM alerts`);
            db.run(`DELETE FROM predictions`);

            // Insert sample usage data
            const usageData = generateUsageData();
            const insertUsage = db.prepare(`
                INSERT INTO usage_data (timestamp, tokens_used, requests_count, avg_response_time, active_users, error_count, cost_usd)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            console.log(`📊 Inserting ${usageData.length} usage records...`);
            usageData.forEach(row => {
                insertUsage.run(
                    row.timestamp,
                    row.tokens_used,
                    row.requests_count,
                    row.avg_response_time,
                    row.active_users,
                    row.error_count,
                    row.cost_usd
                );
            });
            insertUsage.finalize();

            // Insert sample alerts
            const alertsData = generateAlertsData();
            const insertAlert = db.prepare(`
                INSERT INTO alerts (id, level, title, message, timestamp, acknowledged)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            console.log(`🚨 Inserting ${alertsData.length} alert records...`);
            alertsData.forEach(alert => {
                insertAlert.run(
                    alert.id,
                    alert.level,
                    alert.title,
                    alert.message,
                    alert.timestamp,
                    alert.acknowledged
                );
            });
            insertAlert.finalize();

            // Insert sample predictions
            const predictions = [];
            for (let i = 1; i <= 7; i++) {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + i);

                predictions.push({
                    date: futureDate.toISOString().split('T')[0],
                    predicted_tokens: Math.floor(Math.random() * 8000) + 2000,
                    predicted_cost: (Math.random() * 20 + 5).toFixed(2),
                    confidence: (Math.random() * 0.3 + 0.7).toFixed(2)
                });
            }

            const insertPrediction = db.prepare(`
                INSERT INTO predictions (date, predicted_tokens, predicted_cost, confidence)
                VALUES (?, ?, ?, ?)
            `);

            console.log(`📈 Inserting ${predictions.length} prediction records...`);
            predictions.forEach(pred => {
                insertPrediction.run(
                    pred.date,
                    pred.predicted_tokens,
                    pred.predicted_cost,
                    pred.confidence
                );
            });
            insertPrediction.finalize();

            console.log('✅ Sample data initialization complete!');
            resolve();
        });
    });
}

// Run initialization
initializeData()
    .then(() => {
        console.log('🎉 Database populated with sample data');
        db.close();
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error initializing data:', error);
        db.close();
        process.exit(1);
    });