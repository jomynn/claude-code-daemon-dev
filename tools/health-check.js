#!/usr/bin/env node
/**
 * Health Check Script for Docker
 * Checks if the API server is responding
 */

const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/health',
    method: 'GET',
    timeout: 5000
};

const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('Health check passed');
        process.exit(0);
    } else {
        console.log(`Health check failed: HTTP ${res.statusCode}`);
        process.exit(1);
    }
});

req.on('error', (err) => {
    console.log(`Health check failed: ${err.message}`);
    process.exit(1);
});

req.on('timeout', () => {
    console.log('Health check failed: timeout');
    req.destroy();
    process.exit(1);
});

req.end();