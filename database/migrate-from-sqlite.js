#!/usr/bin/env node

/**
 * Migration script to move data from SQLite to PostgreSQL
 */

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

class DatabaseMigrator {
    constructor() {
        this.sqliteDb = null;
        this.pgClient = null;

        // SQLite configuration
        this.sqlitePath = process.env.SQLITE_PATH || '/data/claude-daemon.db';

        // PostgreSQL configuration
        this.pgConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'claude_daemon',
            user: process.env.DB_USER || 'claude_app',
            password: process.env.DB_PASSWORD || 'claude_secure_2024!'
        };
    }

    async connect() {
        console.log('🔌 Connecting to databases...');

        // Connect to SQLite
        this.sqliteDb = new sqlite3.Database(this.sqlitePath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('❌ SQLite connection failed:', err.message);
                throw err;
            }
            console.log('✅ Connected to SQLite database');
        });

        // Connect to PostgreSQL
        this.pgClient = new Client(this.pgConfig);
        await this.pgClient.connect();
        console.log('✅ Connected to PostgreSQL database');
    }

    async migrateUsageData() {
        console.log('📊 Migrating usage data...');

        return new Promise((resolve, reject) => {
            this.sqliteDb.all(
                'SELECT * FROM usage_data ORDER BY timestamp',
                [],
                async (err, rows) => {
                    if (err) {
                        console.error('❌ Failed to read usage data from SQLite:', err);
                        reject(err);
                        return;
                    }

                    console.log(`📝 Found ${rows.length} usage records`);

                    for (const row of rows) {
                        try {
                            await this.pgClient.query(`
                                INSERT INTO usage_data (
                                    timestamp, tokens_used, requests_count, avg_response_time,
                                    active_users, error_count, cost_usd, created_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                ON CONFLICT DO NOTHING
                            `, [
                                row.timestamp,
                                row.tokens_used || 0,
                                row.requests_count || 0,
                                row.avg_response_time || 0,
                                row.active_users || 0,
                                row.error_count || 0,
                                row.cost_usd || 0,
                                row.created_at || row.timestamp
                            ]);
                        } catch (error) {
                            console.warn(`⚠️  Skipped usage record: ${error.message}`);
                        }
                    }

                    console.log('✅ Usage data migration completed');
                    resolve();
                }
            );
        });
    }

    async migrateAlerts() {
        console.log('🚨 Migrating alerts...');

        return new Promise((resolve, reject) => {
            this.sqliteDb.all(
                'SELECT * FROM alerts ORDER BY timestamp',
                [],
                async (err, rows) => {
                    if (err) {
                        console.error('❌ Failed to read alerts from SQLite:', err);
                        reject(err);
                        return;
                    }

                    console.log(`📝 Found ${rows.length} alert records`);

                    for (const row of rows) {
                        try {
                            await this.pgClient.query(`
                                INSERT INTO alerts (
                                    id, level, title, message, timestamp,
                                    acknowledged, created_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                                ON CONFLICT (id) DO NOTHING
                            `, [
                                row.id,
                                row.level,
                                row.title,
                                row.message,
                                row.timestamp,
                                row.acknowledged === 1,
                                row.created_at || row.timestamp
                            ]);
                        } catch (error) {
                            console.warn(`⚠️  Skipped alert record: ${error.message}`);
                        }
                    }

                    console.log('✅ Alerts migration completed');
                    resolve();
                }
            );
        });
    }

    async migratePredictions() {
        console.log('📈 Migrating predictions...');

        return new Promise((resolve, reject) => {
            this.sqliteDb.all(
                'SELECT * FROM predictions ORDER BY date',
                [],
                async (err, rows) => {
                    if (err) {
                        console.error('❌ Failed to read predictions from SQLite:', err);
                        reject(err);
                        return;
                    }

                    console.log(`📝 Found ${rows.length} prediction records`);

                    for (const row of rows) {
                        try {
                            await this.pgClient.query(`
                                INSERT INTO predictions (
                                    date, predicted_tokens, predicted_cost, confidence, created_at
                                ) VALUES ($1, $2, $3, $4, $5)
                                ON CONFLICT DO NOTHING
                            `, [
                                row.date,
                                row.predicted_tokens,
                                row.predicted_cost,
                                row.confidence,
                                row.created_at || new Date().toISOString()
                            ]);
                        } catch (error) {
                            console.warn(`⚠️  Skipped prediction record: ${error.message}`);
                        }
                    }

                    console.log('✅ Predictions migration completed');
                    resolve();
                }
            );
        });
    }

    async verifyMigration() {
        console.log('🔍 Verifying migration...');

        const tables = ['usage_data', 'alerts', 'predictions'];

        for (const table of tables) {
            const result = await this.pgClient.query(`SELECT COUNT(*) FROM ${table}`);
            const count = parseInt(result.rows[0].count);
            console.log(`📊 ${table}: ${count} records`);
        }
    }

    async disconnect() {
        console.log('🔌 Disconnecting from databases...');

        if (this.sqliteDb) {
            this.sqliteDb.close((err) => {
                if (err) {
                    console.error('❌ SQLite disconnect error:', err);
                } else {
                    console.log('✅ SQLite disconnected');
                }
            });
        }

        if (this.pgClient) {
            await this.pgClient.end();
            console.log('✅ PostgreSQL disconnected');
        }
    }

    async migrate() {
        try {
            console.log('🚀 Starting database migration...');

            await this.connect();

            // Run migrations
            await this.migrateUsageData();
            await this.migrateAlerts();
            await this.migratePredictions();

            await this.verifyMigration();

            console.log('🎉 Migration completed successfully!');

        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        } finally {
            await this.disconnect();
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new DatabaseMigrator();

    migrator.migrate()
        .then(() => {
            console.log('✅ Database migration completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = DatabaseMigrator;