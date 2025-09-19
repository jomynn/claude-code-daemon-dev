/**
 * Configuration Module Tests
 */

const config = require('../../src/daemon/config');

describe('Configuration Module', () => {
    test('should load default configuration', () => {
        expect(config).toBeDefined();
        expect(config.database).toBeDefined();
        expect(config.logging).toBeDefined();
        expect(config.server).toBeDefined();
    });

    test('should have required database configuration', () => {
        expect(config.database.path).toBeDefined();
        expect(typeof config.database.path).toBe('string');
        expect(config.database.backup).toBeDefined();
    });

    test('should have required logging configuration', () => {
        expect(config.logging.level).toBeDefined();
        expect(['debug', 'info', 'warn', 'error']).toContain(config.logging.level);
        expect(config.logging.file).toBeDefined();
    });

    test('should have required server configuration', () => {
        expect(config.server.port).toBeDefined();
        expect(typeof config.server.port).toBe('number');
        // In test environment, port might be 0 or a valid port
        expect(config.server.port).toBeGreaterThanOrEqual(0);
        expect(config.server.port).toBeLessThan(65536);
    });

    test('should have monitoring configuration', () => {
        expect(config.monitoring).toBeDefined();
        expect(config.monitoring.interval).toBeDefined();
        expect(config.monitoring.warningThreshold).toBeDefined();
        expect(config.monitoring.criticalThreshold).toBeDefined();
    });

    test('should provide get method for accessing nested values', () => {
        expect(typeof config.get).toBe('function');

        if (config.get) {
            expect(config.get('database.path')).toBe(config.database.path);
            expect(config.get('logging.level')).toBe(config.logging.level);
            expect(config.get('server.port')).toBe(config.server.port);
        }
    });

    test('should provide set method for updating values', () => {
        expect(typeof config.set).toBe('function');

        if (config.set && config.get) {
            const originalValue = config.get('monitoring.interval');
            config.set('monitoring.interval', 999);
            expect(config.get('monitoring.interval')).toBe(999);

            // Restore original value
            config.set('monitoring.interval', originalValue);
        }
    });

    test('should provide validation method', () => {
        expect(typeof config.validate).toBe('function');

        if (config.validate) {
            expect(() => config.validate()).not.toThrow();
        }
    });
});