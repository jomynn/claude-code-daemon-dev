/**
 * Database Configuration API Routes
 * Provides endpoints for database management, testing, and configuration
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const dbConnection = require('../../database/connection');

// Helper function to update .env file
async function updateEnvFile(newConfig) {
    const envPath = path.join(process.cwd(), '.env');
    console.log('🔄 Updating .env file with config:', Object.keys(newConfig));
    console.log('📁 .env file path:', envPath);

    try {
        // Read current .env file
        let envContent = '';
        try {
            envContent = await fs.readFile(envPath, 'utf8');
        } catch (error) {
            // Create .env file if it doesn't exist
            console.log('Creating new .env file');
        }

        // Parse existing environment variables
        const envLines = envContent.split('\n');
        const envVars = new Map();

        // Parse existing variables
        envLines.forEach(line => {
            if (line.trim() && !line.trim().startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    envVars.set(key.trim(), valueParts.join('='));
                }
            }
        });

        // Update with new configuration
        Object.entries(newConfig).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                envVars.set(key, value);
            }
        });

        // Build new .env content
        const updatedLines = [];

        // Add comments and sections
        if (!envContent.includes('# Database Configuration')) {
            updatedLines.push('');
            updatedLines.push('# Database Configuration');
        }

        // Add all environment variables
        const dbKeys = ['DB_TYPE', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DATABASE_PATH', 'DB_MAX_CONNECTIONS', 'DB_CONNECTION_TIMEOUT', 'DB_IDLE_TIMEOUT'];
        const otherKeys = Array.from(envVars.keys()).filter(key => !dbKeys.includes(key));

        // Add non-database variables first (preserve existing structure)
        envLines.forEach(line => {
            if (line.trim().startsWith('#') || line.trim() === '') {
                updatedLines.push(line);
            } else if (line.includes('=')) {
                const [key] = line.split('=');
                if (!dbKeys.includes(key.trim())) {
                    updatedLines.push(line);
                }
            }
        });

        // Add database configuration section
        if (!updatedLines.some(line => line.includes('# Database Configuration'))) {
            updatedLines.push('');
            updatedLines.push('# Database Configuration');
        }

        // Add database variables
        dbKeys.forEach(key => {
            if (envVars.has(key)) {
                updatedLines.push(`${key}=${envVars.get(key)}`);
            }
        });

        // Write updated .env file
        await fs.writeFile(envPath, updatedLines.join('\n') + '\n');
        console.log('✅ .env file updated successfully');

    } catch (error) {
        console.error('❌ Failed to update .env file:', error);
        console.error('❌ Error stack:', error.stack);
        throw new Error(`Failed to update .env file: ${error.message}`);
    }
}

// Get current database status and connection info
router.get('/status', async (req, res) => {
    try {
        const stats = dbConnection.getStats();

        // Check if database connection is available
        if (!dbConnection.pgPool && !dbConnection.sqliteDb) {
            throw new Error('Database connection not initialized');
        }

        // Test connection responsiveness
        const startTime = Date.now();
        await dbConnection.query('SELECT 1 as test');
        const responseTime = Date.now() - startTime;

        // Get connection metrics for PostgreSQL
        let metrics = { avgResponseTime: responseTime };

        if (stats.type === 'postgresql') {
            try {
                const connectionInfo = await dbConnection.query(`
                    SELECT
                        count(*) as active_connections,
                        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
                    FROM pg_stat_activity
                    WHERE state = 'active'
                `);

                if (connectionInfo && connectionInfo.length > 0) {
                    metrics.activeConnections = parseInt(connectionInfo[0].active_connections);
                    metrics.maxConnections = parseInt(connectionInfo[0].max_connections);
                    metrics.totalCount = stats.totalCount || 0;
                }
            } catch (error) {
                console.warn('Could not fetch connection metrics:', error.message);
            }
        }

        res.json({
            success: true,
            data: {
                type: stats.type,
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || stats.path,
                connected: true,
                metrics
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            data: {
                type: 'unknown',
                connected: false
            }
        });
    }
});

// Get current database configuration
router.get('/config', async (req, res) => {
    try {
        const config = {
            type: process.env.DB_TYPE || 'postgresql',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'claude_daemon',
            user: process.env.DB_USER || 'claude_app',
            path: process.env.DATABASE_PATH || '/data/claude-daemon.db',
            maxConnections: 20,
            connectionTimeout: 2000,
            idleTimeout: 30000
        };

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update database configuration
router.post('/config', async (req, res) => {
    try {
        const { dbType, host, port, database, user, password, path, maxConnections, connectionTimeout, idleTimeout } = req.body;

        // Validate configuration
        if (dbType === 'postgresql') {
            if (!host || !port || !database || !user || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required PostgreSQL configuration fields'
                });
            }
        } else if (dbType === 'sqlite') {
            if (!path) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required SQLite path'
                });
            }
        }

        // Update .env file with new configuration
        await updateEnvFile({
            DB_TYPE: dbType,
            DB_HOST: host,
            DB_PORT: port,
            DB_NAME: database,
            DB_USER: user,
            DB_PASSWORD: password,
            DATABASE_PATH: path,
            DB_MAX_CONNECTIONS: maxConnections,
            DB_CONNECTION_TIMEOUT: connectionTimeout,
            DB_IDLE_TIMEOUT: idleTimeout
        });

        res.json({
            success: true,
            message: 'Configuration saved successfully to .env file',
            data: {
                note: 'Configuration saved. Restart application to apply changes.',
                dbType,
                host: dbType === 'postgresql' ? host : 'N/A',
                database: dbType === 'postgresql' ? database : path
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test database connection
router.post('/test/:testType', async (req, res) => {
    const { testType } = req.params;

    try {
        let result;

        switch (testType) {
            case 'basic':
            case 'connection':
                result = await testBasicConnection();
                break;
            case 'query':
                result = await testQuery();
                break;
            case 'insert':
                result = await testInsert();
                break;
            case 'performance':
                result = await testPerformance();
                break;
            default:
                throw new Error(`Unknown test type: ${testType}`);
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute custom query
router.post('/query', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        // Prevent dangerous operations
        const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE'];
        const upperQuery = query.toUpperCase();

        for (const keyword of dangerousKeywords) {
            if (upperQuery.includes(keyword)) {
                return res.status(400).json({
                    success: false,
                    error: `Query contains dangerous keyword: ${keyword}. Only SELECT queries are allowed.`
                });
            }
        }

        const startTime = Date.now();
        const results = await dbConnection.query(query);
        const executionTime = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                results,
                executionTime: `${executionTime}ms`,
                rowCount: results.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check database schema
router.get('/schema/check', async (req, res) => {
    try {
        const tables = await checkDatabaseSchema();

        res.json({
            success: true,
            data: {
                tables,
                isValid: tables.length > 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Apply database schema
router.post('/schema/apply', async (req, res) => {
    try {
        const schemaPath = path.join(__dirname, '../../../database/schema.sql');
        const schemaSQL = await fs.readFile(schemaPath, 'utf8');

        // Execute schema SQL
        await dbConnection.query(schemaSQL);

        res.json({
            success: true,
            message: 'Schema applied successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Reset database schema
router.post('/schema/reset', async (req, res) => {
    try {
        // Get all tables
        const tables = await dbConnection.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
        `);

        // Drop all tables
        for (const table of tables) {
            await dbConnection.query(`DROP TABLE IF EXISTS ${table.tablename} CASCADE`);
        }

        res.json({
            success: true,
            message: 'Schema reset successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Migrate from SQLite
router.post('/migrate', async (req, res) => {
    try {
        const DatabaseMigrator = require('../../../database/migrate-from-sqlite');
        const migrator = new DatabaseMigrator();

        await migrator.migrate();

        res.json({
            success: true,
            message: 'Migration completed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create database backup
router.post('/backup', async (req, res) => {
    try {
        const stats = dbConnection.getStats();

        if (stats.type === 'postgresql') {
            // For PostgreSQL, we would use pg_dump
            // This is a simplified example
            const backup = await dbConnection.query(`
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            `);

            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', 'attachment; filename="database-backup.sql"');
            res.send(`-- Database Backup\n-- Generated: ${new Date().toISOString()}\n\n${JSON.stringify(backup, null, 2)}`);
        } else {
            res.status(400).json({
                success: false,
                error: 'Backup not supported for SQLite in this interface'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get database logs
router.get('/logs', async (req, res) => {
    try {
        // In a real implementation, you would read actual log files
        // For now, return mock log data
        const logs = [
            {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Database connection established'
            },
            {
                timestamp: new Date(Date.now() - 60000).toISOString(),
                level: 'info',
                message: 'Query executed successfully'
            },
            {
                timestamp: new Date(Date.now() - 120000).toISOString(),
                level: 'warn',
                message: 'Connection pool approaching limit'
            }
        ];

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate connection report
router.get('/report', async (req, res) => {
    try {
        const status = await getDatabaseStatus();
        const schema = await checkDatabaseSchema();

        const report = generateHTMLReport(status, schema);

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', 'attachment; filename="database-report.html"');
        res.send(report);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download database schema
router.get('/schema', async (req, res) => {
    try {
        const schemaPath = path.join(__dirname, '../../../database/schema.sql');
        const schemaSQL = await fs.readFile(schemaPath, 'utf8');

        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', 'attachment; filename="schema.sql"');
        res.send(schemaSQL);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download full documentation
router.get('/documentation', async (req, res) => {
    try {
        const docPath = path.join(__dirname, '../../../DATABASE_SERVER_GUIDE.md');
        const documentation = await fs.readFile(docPath, 'utf8');

        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', 'attachment; filename="DATABASE_SERVER_GUIDE.md"');
        res.send(documentation);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper functions
async function testBasicConnection() {
    const startTime = Date.now();
    await dbConnection.query('SELECT 1 as test');
    const responseTime = Date.now() - startTime;

    const stats = dbConnection.getStats();

    return {
        status: 'Connected',
        type: stats.type,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
    };
}

async function testQuery() {
    const queries = [
        'SELECT COUNT(*) as usage_count FROM usage_data',
        'SELECT COUNT(*) as alert_count FROM alerts',
        'SELECT COUNT(*) as prediction_count FROM predictions'
    ];

    const results = {};

    for (const query of queries) {
        try {
            const result = await dbConnection.query(query);
            const tableName = query.match(/FROM (\w+)/)[1];
            results[tableName] = result[0] || { count: 0 };
        } catch (error) {
            results[query] = { error: error.message };
        }
    }

    return results;
}

async function testInsert() {
    try {
        const testData = {
            timestamp: new Date().toISOString(),
            tokens_used: 100,
            requests_count: 5,
            avg_response_time: 500,
            active_users: 1,
            error_count: 0,
            cost_usd: 0.0002
        };

        const result = await dbConnection.insert('usage_data', testData);

        return {
            status: 'Insert successful',
            insertedId: result.id || result.lastID,
            testData
        };
    } catch (error) {
        throw new Error(`Insert test failed: ${error.message}`);
    }
}

async function testPerformance() {
    const tests = [];

    // Test 1: Simple query performance
    let startTime = Date.now();
    await dbConnection.query('SELECT 1');
    tests.push({
        test: 'Simple Query',
        time: `${Date.now() - startTime}ms`
    });

    // Test 2: Count query performance
    startTime = Date.now();
    await dbConnection.query('SELECT COUNT(*) FROM usage_data');
    tests.push({
        test: 'Count Query',
        time: `${Date.now() - startTime}ms`
    });

    // Test 3: Complex query performance
    try {
        startTime = Date.now();
        await dbConnection.query(`
            SELECT DATE(timestamp) as date,
                   COUNT(*) as records,
                   AVG(tokens_used) as avg_tokens
            FROM usage_data
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
            LIMIT 5
        `);
        tests.push({
            test: 'Complex Query',
            time: `${Date.now() - startTime}ms`
        });
    } catch (error) {
        tests.push({
            test: 'Complex Query',
            time: 'N/A',
            error: error.message
        });
    }

    return tests;
}

async function checkDatabaseSchema() {
    try {
        const tables = await dbConnection.query(`
            SELECT
                table_name as name,
                (SELECT COUNT(*) FROM information_schema.columns
                 WHERE table_name = t.table_name AND table_schema = 'public') as columns
            FROM information_schema.tables t
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        return tables;
    } catch (error) {
        // Fallback for SQLite
        try {
            const tables = await dbConnection.query(`
                SELECT name FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            return tables.map(table => ({ name: table.name, columns: 'N/A' }));
        } catch (sqliteError) {
            throw new Error(`Failed to check schema: ${error.message}`);
        }
    }
}

async function getDatabaseStatus() {
    const stats = dbConnection.getStats();

    return {
        type: stats.type,
        connected: true,
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || stats.path,
        timestamp: new Date().toISOString()
    };
}

function generateHTMLReport(status, schema) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Database Connection Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #007bff; color: white; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .status-ok { color: green; }
        .status-error { color: red; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Database Connection Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="section">
        <h2>Connection Status</h2>
        <p><strong>Type:</strong> ${status.type}</p>
        <p><strong>Host:</strong> ${status.host}</p>
        <p><strong>Database:</strong> ${status.database}</p>
        <p><strong>Status:</strong> <span class="status-ok">Connected</span></p>
    </div>

    <div class="section">
        <h2>Schema Information</h2>
        <table>
            <thead>
                <tr><th>Table Name</th><th>Columns</th></tr>
            </thead>
            <tbody>
                ${schema.map(table => `
                    <tr>
                        <td>${table.name}</td>
                        <td>${table.columns}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;
}

module.exports = router;