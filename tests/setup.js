/**
 * Jest Setup File
 * Global test configuration and utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global test timeout
jest.setTimeout(10000);

// Mock external dependencies that shouldn't run during tests
jest.mock('nodemailer', () => ({
    createTransporter: jest.fn(() => ({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
    }))
}));

// Global test utilities
global.testUtils = {
    // Wait for a specified amount of time
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Generate test data
    generateUsageData: (count = 10) => {
        const data = [];
        const now = Date.now();

        for (let i = 0; i < count; i++) {
            data.push({
                timestamp: new Date(now - i * 60 * 60 * 1000).toISOString(),
                tokens: Math.floor(Math.random() * 1000),
                requests: Math.floor(Math.random() * 50),
                tokens_per_hour: Math.floor(Math.random() * 100),
                requests_per_hour: Math.floor(Math.random() * 10)
            });
        }

        return data;
    },

    // Generate test alerts
    generateAlerts: (count = 5) => {
        const severities = ['info', 'warning', 'critical'];
        const types = ['usage-warning', 'limit-warning', 'system-alert'];
        const alerts = [];

        for (let i = 0; i < count; i++) {
            alerts.push({
                id: i + 1,
                timestamp: new Date().toISOString(),
                type: types[i % types.length],
                severity: severities[i % severities.length],
                message: `Test alert ${i + 1}`,
                data: JSON.stringify({ test: true, value: i })
            });
        }

        return alerts;
    }
};

// Cleanup after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🧪 Test environment initialized');