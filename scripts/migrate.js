#!/usr/bin/env node

/**
 * Database Migration Script
 * Initializes and manages database schema
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './data/claude-daemon.db';
const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

class DatabaseMigrator {
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
                console.log('✅ Connected to SQLite database');
                resolve();
            });
        });
    }

    async createMigrationsTable() {
        return new Promise((resolve, reject) => {
            const sql = `
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log('✅ Migrations table ready');
                resolve();
            });
        });
    }

    async getAppliedMigrations() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT filename FROM migrations ORDER BY applied_at';

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(row => row.filename));
            });
        });
    }

    async applyMigration(filename, sql) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                this.db.exec(sql, (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }

                    this.db.run(
                        'INSERT INTO migrations (filename) VALUES (?)',
                        [filename],
                        (err) => {
                            if (err) {
                                this.db.run('ROLLBACK');
                                reject(err);
                                return;
                            }

                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                resolve();
                            });
                        }
                    );
                });
            });
        });
    }

    async runMigrations() {
        try {
            console.log('🔄 Running database migrations...');

            // Get applied migrations
            const appliedMigrations = await this.getAppliedMigrations();
            console.log(`📋 Found ${appliedMigrations.length} previously applied migrations`);

            // Read migration files
            let migrationFiles = [];
            try {
                const files = await fs.readdir(MIGRATIONS_DIR);
                migrationFiles = files.filter(f => f.endsWith('.sql')).sort();
            } catch (error) {
                console.log('📁 No migrations directory found, creating with initial migration');
                await this.createMigrationsDirectory();
                migrationFiles = ['001_initial.sql'];
            }

            // Apply new migrations
            let appliedCount = 0;
            for (const filename of migrationFiles) {
                if (!appliedMigrations.includes(filename)) {
                    console.log(`🔄 Applying migration: ${filename}`);

                    const migrationPath = path.join(MIGRATIONS_DIR, filename);
                    const sql = await fs.readFile(migrationPath, 'utf8');

                    await this.applyMigration(filename, sql);
                    console.log(`✅ Applied migration: ${filename}`);
                    appliedCount++;
                }
            }

            if (appliedCount === 0) {
                console.log('✅ Database is up to date - no new migrations to apply');
            } else {
                console.log(`✅ Applied ${appliedCount} new migrations`);
            }

        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    }

    async createMigrationsDirectory() {
        await fs.mkdir(MIGRATIONS_DIR, { recursive: true });

        // Create initial migration
        const initialMigration = `-- Initial database schema
-- Tables for Claude Code Daemon

-- Usage data table
CREATE TABLE IF NOT EXISTS usage_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    tokens INTEGER DEFAULT 0,
    requests INTEGER DEFAULT 0,
    tokens_per_hour REAL DEFAULT 0,
    requests_per_hour REAL DEFAULT 0,
    metadata TEXT
);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    predicted_limit_time DATETIME,
    hours_remaining REAL,
    confidence REAL,
    model_version TEXT
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME
);

-- System metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_usage REAL,
    memory_usage REAL,
    disk_usage REAL,
    uptime INTEGER,
    connections INTEGER
);

-- BMAD workflows table
CREATE TABLE IF NOT EXISTS bmad_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    config TEXT,
    results TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_bmad_workflows_status ON bmad_workflows(status);
`;

        await fs.writeFile(path.join(MIGRATIONS_DIR, '001_initial.sql'), initialMigration);
        console.log('📁 Created migrations directory with initial migration');
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

    async healthCheck() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM usage_data', [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log(`📊 Database health check: ${row.count} usage records`);
                resolve(row.count);
            });
        });
    }
}

// CLI functionality
async function main() {
    const command = process.argv[2] || 'migrate';
    const migrator = new DatabaseMigrator();

    try {
        await migrator.initialize();
        await migrator.createMigrationsTable();

        switch (command) {
            case 'migrate':
                await migrator.runMigrations();
                await migrator.healthCheck();
                break;

            case 'reset':
                console.log('🔄 Resetting database...');
                // This would drop all tables and re-run migrations
                console.log('⚠️  Reset not implemented - manually delete database file if needed');
                break;

            case 'status':
                const applied = await migrator.getAppliedMigrations();
                console.log('📋 Applied migrations:');
                applied.forEach(migration => console.log(`  ✅ ${migration}`));
                break;

            case 'health':
                await migrator.healthCheck();
                break;

            default:
                console.log('Usage: node migrate.js [migrate|reset|status|health]');
                process.exit(1);
        }

        console.log('✅ Migration completed successfully');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await migrator.close();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = DatabaseMigrator;