/**
 * API Integration Tests
 */

const request = require('supertest');
const ApiServer = require('../../src/api/server');

describe('API Server Integration', () => {
    let server;
    let app;

    beforeAll(async () => {
        // Create server instance but don't start it on a port
        server = new ApiServer();
        app = server.app;
    });

    afterAll(async () => {
        if (server) {
            // Clear any intervals
            if (server.usageUpdateInterval) {
                clearInterval(server.usageUpdateInterval);
            }
            if (server.systemStatusInterval) {
                clearInterval(server.systemStatusInterval);
            }

            // Close the server
            if (server.server) {
                await new Promise((resolve) => {
                    server.server.close(resolve);
                });
            }
        }
    });

    describe('Health Check', () => {
        test('GET /health should return 200', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('version');
        });
    });

    describe('Dashboard Routes', () => {
        test('GET / should return dashboard page', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.text).toContain('Claude Code Daemon Dashboard');
        });

        test('GET /usage should return usage page', async () => {
            const response = await request(app)
                .get('/usage')
                .expect(200);

            expect(response.text).toContain('Usage Analytics');
        });

        test('GET /alerts should return alerts page', async () => {
            const response = await request(app)
                .get('/alerts')
                .expect(200);

            expect(response.text).toContain('Alerts & Notifications');
        });
    });

    describe('API Routes', () => {
        test('GET /api/usage/current should return usage data', async () => {
            const response = await request(app)
                .get('/api/usage/current')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            if (response.body.success) {
                expect(response.body).toHaveProperty('data');
            }
        });

        test('GET /api/alerts should return alerts', async () => {
            const response = await request(app)
                .get('/api/alerts')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            if (response.body.success) {
                expect(response.body).toHaveProperty('data');
                expect(response.body).toHaveProperty('count');
            }
        });

        test('GET /api/system/status should return system status', async () => {
            const response = await request(app)
                .get('/api/system/status')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            if (response.body.success) {
                expect(response.body).toHaveProperty('data');
            }
        });
    });

    describe('Error Handling', () => {
        test('GET /nonexistent should return 404', async () => {
            const response = await request(app)
                .get('/nonexistent')
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Not Found');
            expect(response.body).toHaveProperty('message');
        });

        test('POST /api/alerts with invalid data should return 400', async () => {
            const response = await request(app)
                .post('/api/alerts')
                .send({}) // Empty body
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('CORS Headers', () => {
        test('should include CORS headers', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });

        test('should handle OPTIONS requests', async () => {
            await request(app)
                .options('/api/usage/current')
                .expect(204);
        });
    });

    describe('Security Headers', () => {
        test('should include security headers', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            // Check for basic security headers
            expect(response.headers).toHaveProperty('x-frame-options');
            expect(response.headers).toHaveProperty('x-content-type-options');
        });
    });

    describe('Static Files', () => {
        test('should serve static CSS files', async () => {
            const response = await request(app)
                .get('/static/css/dashboard.css')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/text\/css/);
        });

        test('should serve static JS files', async () => {
            const response = await request(app)
                .get('/static/js/dashboard.js')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/application\/javascript/);
        });
    });
});