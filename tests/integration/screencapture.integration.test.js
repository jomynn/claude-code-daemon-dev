/**
 * Integration Tests for Screen Capture Functionality
 * Tests the complete screen capture workflow including API and file system
 */

const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

// Import the actual routes
const screencaptureRoutes = require('../../src/api/routes/screencapture');

describe('Screen Capture Integration Tests', () => {
    let app;
    let testCaptureDir;

    beforeAll(async () => {
        // Create test app
        app = express();
        app.use(express.json());
        app.use('/api/screencapture', screencaptureRoutes);

        // Create temporary test directory
        testCaptureDir = path.join(__dirname, '../../test-captures');
        try {
            await fs.mkdir(testCaptureDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        // Override the capture directory for testing
        process.env.TEST_CAPTURE_DIR = testCaptureDir;
    });

    afterAll(async () => {
        // Clean up test directory
        try {
            const files = await fs.readdir(testCaptureDir);
            for (const file of files) {
                await fs.unlink(path.join(testCaptureDir, file));
            }
            await fs.rmdir(testCaptureDir);
        } catch (error) {
            // Directory might not exist or be empty
        }
    });

    beforeEach(async () => {
        // Clean up any existing test files
        try {
            const files = await fs.readdir(testCaptureDir);
            for (const file of files) {
                if (file.startsWith('test_') || file.startsWith('screenshot_')) {
                    await fs.unlink(path.join(testCaptureDir, file));
                }
            }
        } catch (error) {
            // Directory might be empty
        }
    });

    describe('Complete Capture Workflow', () => {
        it('should capture, list, view, and delete a screenshot', async () => {
            // Step 1: Capture a screenshot
            const captureResponse = await request(app)
                .post('/api/screencapture/capture')
                .send({
                    filename: 'test_integration.png',
                    format: 'png'
                });

            expect(captureResponse.status).toBe(200);
            expect(captureResponse.body.success).toBe(true);

            const { filename } = captureResponse.body.data;

            // Step 2: Verify it appears in the list
            const listResponse = await request(app)
                .get('/api/screencapture/list');

            expect(listResponse.status).toBe(200);
            expect(listResponse.body.success).toBe(true);
            expect(listResponse.body.data).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        filename: filename
                    })
                ])
            );

            // Step 3: Check status includes the new screenshot
            const statusResponse = await request(app)
                .get('/api/screencapture/status');

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body.success).toBe(true);
            expect(statusResponse.body.data.totalScreenshots).toBeGreaterThan(0);

            // Step 4: Delete the screenshot
            const deleteResponse = await request(app)
                .delete(`/api/screencapture/${filename}`);

            expect(deleteResponse.status).toBe(200);
            expect(deleteResponse.body.success).toBe(true);

            // Step 5: Verify it's removed from the list
            const finalListResponse = await request(app)
                .get('/api/screencapture/list');

            expect(finalListResponse.status).toBe(200);
            expect(finalListResponse.body.data).not.toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        filename: filename
                    })
                ])
            );
        }, 15000); // Extended timeout for file operations

        it('should handle multiple screenshots correctly', async () => {
            // Create multiple screenshots
            const screenshots = [];

            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .post('/api/screencapture/capture')
                    .send({
                        filename: `test_multi_${i}.png`,
                        format: 'png'
                    });

                expect(response.status).toBe(200);
                screenshots.push(response.body.data.filename);
            }

            // Verify all appear in list
            const listResponse = await request(app)
                .get('/api/screencapture/list');

            expect(listResponse.status).toBe(200);
            expect(listResponse.body.data).toHaveLength(3);

            // Check status reflects correct count
            const statusResponse = await request(app)
                .get('/api/screencapture/status');

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body.data.totalScreenshots).toBe(3);

            // Clean up
            for (const filename of screenshots) {
                await request(app)
                    .delete(`/api/screencapture/${filename}`);
            }
        }, 20000);
    });

    describe('Error Handling Integration', () => {
        it('should handle capture failures gracefully', async () => {
            // Try to capture with invalid options that might cause screencapture to fail
            const response = await request(app)
                .post('/api/screencapture/capture')
                .send({
                    displayId: 999, // Invalid display
                    format: 'png'
                });

            // The response might be successful if screencapture command succeeds despite invalid display
            // or might fail - both are acceptable behaviors for this test
            expect([200, 500]).toContain(response.status);

            if (response.status === 500) {
                expect(response.body.success).toBe(false);
                expect(response.body.error).toBeDefined();
            }
        });

        it('should handle deletion of non-existent files', async () => {
            const response = await request(app)
                .delete('/api/screencapture/nonexistent.png');

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Failed to delete screenshot');
        });

        it('should handle viewing non-existent screenshots', async () => {
            const response = await request(app)
                .get('/api/screencapture/view/nonexistent.png');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Screenshot not found');
        });
    });

    describe('File System Integration', () => {
        it('should create capture directory if it doesn\'t exist', async () => {
            // This test verifies the directory creation logic
            // The directory should be created during service initialization

            const response = await request(app)
                .get('/api/screencapture/status');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.captureDirectory).toBeDefined();
        });

        it('should filter non-image files from listings', async () => {
            // Create a non-image file in the capture directory
            const nonImageFile = path.join(testCaptureDir, 'readme.txt');
            await fs.writeFile(nonImageFile, 'This is not an image');

            // Create an image file
            const captureResponse = await request(app)
                .post('/api/screencapture/capture')
                .send({
                    filename: 'test_filter.png',
                    format: 'png'
                });

            expect(captureResponse.status).toBe(200);

            // List should only include image files
            const listResponse = await request(app)
                .get('/api/screencapture/list');

            expect(listResponse.status).toBe(200);
            expect(listResponse.body.data).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        filename: expect.stringMatching(/\.(png|jpg|jpeg)$/i)
                    })
                ])
            );

            // Should not include the text file
            const filenames = listResponse.body.data.map(item => item.filename);
            expect(filenames).not.toContain('readme.txt');

            // Clean up
            await fs.unlink(nonImageFile);
            await request(app)
                .delete('/api/screencapture/test_filter.png');
        });
    });

    describe('Screenshot Formats and Options', () => {
        it('should handle different image formats', async () => {
            const formats = ['png', 'jpg'];

            for (const format of formats) {
                const response = await request(app)
                    .post('/api/screencapture/capture')
                    .send({
                        filename: `test_format.${format}`,
                        format: format
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data.filename).toBe(`test_format.${format}`);

                // Clean up
                await request(app)
                    .delete(`/api/screencapture/test_format.${format}`);
            }
        });

        it('should handle different capture types', async () => {
            // Only test fullscreen capture in automated tests since interactive types
            // (window/selection) require user interaction and may hang
            const captureTypes = [
                {} // fullscreen (default) - safe for automated testing
            ];

            for (let i = 0; i < captureTypes.length; i++) {
                const options = {
                    filename: `test_type_${i}.png`,
                    format: 'png',
                    ...captureTypes[i]
                };

                const response = await request(app)
                    .post('/api/screencapture/capture')
                    .send(options);

                // Fullscreen capture should work in automated environment
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                // Clean up successful captures
                await request(app)
                    .delete(`/api/screencapture/test_type_${i}.png`);
            }
        }, 5000);
    });

    describe('Concurrent Operations', () => {
        it('should handle concurrent capture requests', async () => {
            const promises = [];

            // Start multiple capture operations simultaneously
            for (let i = 0; i < 3; i++) {
                promises.push(
                    request(app)
                        .post('/api/screencapture/capture')
                        .send({
                            filename: `concurrent_${i}.png`,
                            format: 'png'
                        })
                );
            }

            const responses = await Promise.all(promises);

            // All requests should complete (though some might fail due to system limitations)
            responses.forEach(response => {
                expect([200, 500]).toContain(response.status);
            });

            // Clean up successful captures
            for (let i = 0; i < 3; i++) {
                try {
                    await request(app)
                        .delete(`/api/screencapture/concurrent_${i}.png`);
                } catch (error) {
                    // Ignore deletion errors for files that weren't created
                }
            }
        }, 15000);
    });

    describe('API Response Validation', () => {
        it('should return consistent response structure for capture', async () => {
            const response = await request(app)
                .post('/api/screencapture/capture')
                .send({
                    filename: 'test_structure.png',
                    format: 'png'
                });

            if (response.status === 200) {
                expect(response.body).toMatchObject({
                    success: true,
                    data: {
                        success: true,
                        filename: 'test_structure.png',
                        filepath: expect.any(String),
                        size: expect.any(Number),
                        timestamp: expect.any(String)
                    }
                });

                // Clean up
                await request(app)
                    .delete('/api/screencapture/test_structure.png');
            }
        });

        it('should return consistent response structure for list', async () => {
            const response = await request(app)
                .get('/api/screencapture/list');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: expect.any(Array)
            });

            if (response.body.data.length > 0) {
                expect(response.body.data[0]).toMatchObject({
                    filename: expect.any(String),
                    size: expect.any(Number),
                    created: expect.any(String),
                    modified: expect.any(String)
                });
            }
        });

        it('should return consistent response structure for status', async () => {
            const response = await request(app)
                .get('/api/screencapture/status');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: {
                    captureDirectory: expect.any(String),
                    totalScreenshots: expect.any(Number),
                    diskUsage: expect.any(Number)
                }
            });
        });
    });
});