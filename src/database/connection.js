/**
 * Centralized Database Connection Manager
 * Handles both PostgreSQL and SQLite connections
 */

const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseConnection {
    constructor() {
        this.pgPool = null;
        this.sqliteDb = null;
        this.dbType = process.env.DB_TYPE || 'postgresql';

        // PostgreSQL configuration
        this.pgConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'claude_daemon',
            user: process.env.DB_USER || 'claude_app',
            password: process.env.DB_PASSWORD || 'claude_secure_2024!',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        // SQLite configuration (fallback)
        this.sqlitePath = process.env.DATABASE_PATH || './data/claude-daemon.db';
    }

    async initialize() {
        console.log(`🔌 Initializing ${this.dbType} database connection...`);

        if (this.dbType === 'postgresql') {
            await this.initializePostgreSQL();
        } else {
            await this.initializeSQLite();
        }
    }

    async initializePostgreSQL() {
        try {
            this.pgPool = new Pool(this.pgConfig);

            // Test connection
            const client = await this.pgPool.connect();
            console.log('✅ PostgreSQL connection established');

            // Test query
            const result = await client.query('SELECT NOW() as current_time');
            console.log(`📅 Database time: ${result.rows[0].current_time}`);

            client.release();

            // Handle pool errors
            this.pgPool.on('error', (err) => {
                console.error('❌ PostgreSQL pool error:', err);
            });

        } catch (error) {
            console.error('❌ PostgreSQL initialization failed:', error);

            // Fallback to SQLite
            console.log('🔄 Falling back to SQLite...');
            this.dbType = 'sqlite';
            await this.initializeSQLite();
        }
    }

    async initializeSQLite() {
        try {
            // Ensure directory exists
            const dbDir = path.dirname(this.sqlitePath);
            const fs = require('fs');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.sqliteDb = new sqlite3.Database(this.sqlitePath, (err) => {
                if (err) {
                    console.error('❌ SQLite connection failed:', err);
                    throw err;
                }
                console.log('✅ SQLite connection established');
            });

            // Create tables if they don't exist
            await this.createSQLiteTables();

        } catch (error) {
            console.error('❌ SQLite initialization failed:', error);
            throw error;
        }
    }

    async createSQLiteTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS usage_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                requests_count INTEGER DEFAULT 0,
                avg_response_time INTEGER DEFAULT 0,
                active_users INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0.0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                level TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                timestamp TEXT NOT NULL,
                acknowledged INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                predicted_tokens INTEGER,
                predicted_cost REAL,
                confidence REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            await this.runSQLiteQuery(sql);
        }
    }

    async query(sql, params = []) {
        if (this.dbType === 'postgresql') {
            return await this.pgQuery(sql, params);
        } else {
            return await this.sqliteQuery(sql, params);
        }
    }

    async pgQuery(sql, params = []) {
        const client = await this.pgPool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async sqliteQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async runSQLiteQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async insert(table, data) {
        if (this.dbType === 'postgresql') {
            return await this.pgInsert(table, data);
        } else {
            return await this.sqliteInsert(table, data);
        }
    }

    async pgInsert(table, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await this.pgQuery(sql, values);
        return result[0];
    }

    async sqliteInsert(table, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map(() => '?').join(', ');

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        return await this.runSQLiteQuery(sql, values);
    }

    async select(table, where = {}, options = {}) {
        let sql = `SELECT * FROM ${table}`;
        const params = [];

        if (Object.keys(where).length > 0) {
            const conditions = Object.keys(where).map((key, i) => {
                params.push(where[key]);
                return this.dbType === 'postgresql' ? `${key} = $${i + 1}` : `${key} = ?`;
            });
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        if (options.orderBy) {
            sql += ` ORDER BY ${options.orderBy}`;
        }

        if (options.limit) {
            sql += ` LIMIT ${options.limit}`;
        }

        return await this.query(sql, params);
    }

    async update(table, data, where) {
        const setClause = Object.keys(data).map((key, i) => {
            return this.dbType === 'postgresql' ? `${key} = $${i + 1}` : `${key} = ?`;
        }).join(', ');

        const whereClause = Object.keys(where).map((key, i) => {
            return this.dbType === 'postgresql' ? `${key} = $${Object.keys(data).length + i + 1}` : `${key} = ?`;
        }).join(' AND ');

        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        const params = [...Object.values(data), ...Object.values(where)];

        if (this.dbType === 'postgresql') {
            return await this.pgQuery(sql, params);
        } else {
            return await this.runSQLiteQuery(sql, params);
        }
    }

    async close() {
        console.log('🔌 Closing database connections...');

        if (this.pgPool) {
            await this.pgPool.end();
            console.log('✅ PostgreSQL connection closed');
        }

        if (this.sqliteDb) {
            this.sqliteDb.close((err) => {
                if (err) {
                    console.error('❌ SQLite close error:', err);
                } else {
                    console.log('✅ SQLite connection closed');
                }
            });
        }
    }

    getStats() {
        if (this.dbType === 'postgresql' && this.pgPool) {
            return {
                type: 'postgresql',
                totalCount: this.pgPool.totalCount,
                idleCount: this.pgPool.idleCount,
                waitingCount: this.pgPool.waitingCount
            };
        } else {
            return {
                type: 'sqlite',
                path: this.sqlitePath
            };
        }
    }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;