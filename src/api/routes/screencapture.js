/**
 * Screen Capture API Routes
 * Handles screenshot functionality and management
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ScreenCaptureService {
    constructor() {
        this.captureDir = path.join(process.cwd(), 'captures');
        this.ensureCaptureDirectory();
    }

    async ensureCaptureDirectory() {
        try {
            await fs.access(this.captureDir);
        } catch (error) {
            await fs.mkdir(this.captureDir, { recursive: true });
        }
    }

    async takeScreenshot(options = {}) {
        const {
            filename = `screenshot_${Date.now()}.png`,
            displayId = 1,
            format = 'png',
            quality = 100
        } = options;

        const filepath = path.join(this.captureDir, filename);

        try {
            // Use macOS screencapture command
            let command = `screencapture -x -t ${format}`;

            if (options.window) {
                command += ' -w';
            } else if (options.selection) {
                command += ' -s';
            } else {
                command += ` -D ${displayId}`;
            }

            command += ` "${filepath}"`;

            await execAsync(command);

            // Verify file was created
            const stats = await fs.stat(filepath);

            return {
                success: true,
                filename,
                filepath,
                size: stats.size,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Screenshot failed: ${error.message}`);
        }
    }

    async listScreenshots() {
        try {
            const files = await fs.readdir(this.captureDir);
            const screenshots = [];

            for (const file of files) {
                // Filter out hidden files (starting with .) and ensure it's an image
                if (!file.startsWith('.') && file.match(/\.(png|jpg|jpeg)$/i)) {
                    const filepath = path.join(this.captureDir, file);
                    const stats = await fs.stat(filepath);

                    screenshots.push({
                        filename: file,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }

            return screenshots.sort((a, b) => b.created - a.created);
        } catch (error) {
            throw new Error(`Failed to list screenshots: ${error.message}`);
        }
    }

    async deleteScreenshot(filename) {
        try {
            const filepath = path.join(this.captureDir, filename);
            await fs.unlink(filepath);
            return { success: true, filename };
        } catch (error) {
            throw new Error(`Failed to delete screenshot: ${error.message}`);
        }
    }

    async getScreenshot(filename) {
        try {
            const filepath = path.join(this.captureDir, filename);
            await fs.access(filepath);
            return filepath;
        } catch (error) {
            throw new Error(`Screenshot not found: ${filename}`);
        }
    }
}

const screenCaptureService = new ScreenCaptureService();

// Take a screenshot
router.post('/capture', async (req, res) => {
    try {
        const result = await screenCaptureService.takeScreenshot(req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List all screenshots
router.get('/list', async (req, res) => {
    try {
        const screenshots = await screenCaptureService.listScreenshots();
        res.json({ success: true, data: screenshots });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get a specific screenshot
router.get('/view/:filename', async (req, res) => {
    try {
        const filepath = await screenCaptureService.getScreenshot(req.params.filename);
        res.sendFile(filepath);
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Delete a screenshot
router.delete('/:filename', async (req, res) => {
    try {
        const result = await screenCaptureService.deleteScreenshot(req.params.filename);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get capture status/info
router.get('/status', async (req, res) => {
    try {
        const screenshots = await screenCaptureService.listScreenshots();
        const captureDir = screenCaptureService.captureDir;

        res.json({
            success: true,
            data: {
                captureDirectory: captureDir,
                totalScreenshots: screenshots.length,
                latestScreenshot: screenshots[0] || null,
                diskUsage: screenshots.reduce((total, shot) => total + shot.size, 0)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;