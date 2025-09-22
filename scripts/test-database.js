#!/usr/bin/env node

/**
 * Database connection test script
 */

const dbConnection = require('../src/database/connection');

async function testDatabase() {
    try {
        console.log('🔍 Testing database connection...');

        // Initialize connection
        await dbConnection.initialize();

        // Test basic operations
        console.log('📊 Testing basic operations...');

        // Insert test data
        const testUsage = {
            timestamp: new Date().toISOString(),
            tokens_used: 1000,
            requests_count: 50,
            avg_response_time: 1500,
            active_users: 5,
            error_count: 0,
            cost_usd: 0.002
        };

        await dbConnection.insert('usage_data', testUsage);
        console.log('✅ Insert test passed');

        // Select test data
        const results = await dbConnection.select('usage_data', {}, {
            orderBy: 'timestamp DESC',
            limit: 5
        });

        console.log(`✅ Select test passed, found ${results.length} records`);

        // Test alert creation
        const testAlert = {
            id: 'test_' + Date.now(),
            level: 'info',
            title: 'Database Test',
            message: 'Database connection test successful',
            timestamp: new Date().toISOString(),
            acknowledged: false
        };

        await dbConnection.insert('alerts', testAlert);
        console.log('✅ Alert creation test passed');

        // Get database stats
        const stats = dbConnection.getStats();
        console.log('📊 Database stats:', stats);

        console.log('🎉 All database tests passed!');

    } catch (error) {
        console.error('❌ Database test failed:', error);
        process.exit(1);
    } finally {
        await dbConnection.close();
    }
}

testDatabase();