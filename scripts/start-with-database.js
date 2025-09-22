#!/usr/bin/env node

/**
 * Enhanced startup script with database migration
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Claude Code Daemon with Database Server...');

async function waitForDatabase() {
    const dbConnection = require('../src/database/connection');

    console.log('⏳ Waiting for database to be ready...');

    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
        try {
            await dbConnection.initialize();
            console.log('✅ Database connection established');
            await dbConnection.close();
            return true;
        } catch (error) {
            attempts++;
            console.log(`🔄 Database not ready (attempt ${attempts}/${maxAttempts}), retrying in 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    throw new Error('❌ Database connection failed after maximum attempts');
}

async function runMigration() {
    console.log('🔄 Running database migration...');

    try {
        // Check if SQLite database exists
        const sqlitePath = process.env.DATABASE_PATH || '/data/claude-daemon.db';

        if (fs.existsSync(sqlitePath)) {
            console.log('📦 Found existing SQLite database, migrating data...');

            const DatabaseMigrator = require('../database/migrate-from-sqlite');
            const migrator = new DatabaseMigrator();

            await migrator.migrate();
            console.log('✅ Data migration completed');

            // Backup SQLite file
            const backupPath = sqlitePath + '.backup.' + Date.now();
            fs.copyFileSync(sqlitePath, backupPath);
            console.log(`💾 SQLite backup created: ${backupPath}`);

        } else {
            console.log('ℹ️  No existing SQLite database found, starting fresh');
        }

    } catch (error) {
        console.warn('⚠️  Migration failed, continuing with fresh database:', error.message);
    }
}

async function startServer() {
    console.log('🌟 Starting API server...');

    const serverPath = path.join(__dirname, '../src/api/server.js');

    const server = spawn('node', [serverPath], {
        stdio: 'inherit',
        env: {
            ...process.env,
            DB_TYPE: 'postgresql'
        }
    });

    server.on('close', (code) => {
        console.log(`📊 Server process exited with code ${code}`);
        process.exit(code);
    });

    server.on('error', (error) => {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => {
        console.log('🛑 Received SIGTERM, shutting down gracefully...');
        server.kill('SIGTERM');
    });

    process.on('SIGINT', () => {
        console.log('🛑 Received SIGINT, shutting down gracefully...');
        server.kill('SIGINT');
    });
}

async function main() {
    try {
        // Wait for database to be ready
        await waitForDatabase();

        // Run migration if needed
        await runMigration();

        // Start the server
        await startServer();

    } catch (error) {
        console.error('❌ Startup failed:', error);
        process.exit(1);
    }
}

// Run the main function
main();