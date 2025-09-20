/**
 * Logs API Routes
 * Handles container logs viewing
 */

const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();

/**
 * Get container logs
 */
router.get('/container', (req, res) => {
    const limit = req.query.limit || 100;
    const follow = req.query.follow === 'true';

    try {
        // Get current container ID
        const getContainerCmd = spawn('docker', ['ps', '--filter', 'name=claude-code-daemon', '--format', '{{.ID}}']);
        let containerId = '';

        getContainerCmd.stdout.on('data', (data) => {
            containerId = data.toString().trim();
        });

        getContainerCmd.on('close', (code) => {
            if (code === 0 && containerId) {
                // Get logs from the container
                const args = ['logs', `--tail=${limit}`];
                if (follow) args.push('-f');
                args.push(containerId);

                const logsCmd = spawn('docker', args);
                const logs = [];

                logsCmd.stdout.on('data', (data) => {
                    const lines = data.toString().split('\n').filter(line => line.trim());
                    logs.push(...lines);
                });

                logsCmd.stderr.on('data', (data) => {
                    const lines = data.toString().split('\n').filter(line => line.trim());
                    logs.push(...lines);
                });

                if (follow) {
                    // For streaming logs
                    res.writeHead(200, {
                        'Content-Type': 'text/plain',
                        'Transfer-Encoding': 'chunked'
                    });

                    logsCmd.stdout.on('data', (data) => {
                        res.write(data);
                    });

                    logsCmd.stderr.on('data', (data) => {
                        res.write(data);
                    });

                    req.on('close', () => {
                        logsCmd.kill();
                    });
                } else {
                    logsCmd.on('close', (code) => {
                        res.json({
                            success: true,
                            data: {
                                containerId,
                                logs: logs.slice(-limit),
                                count: logs.length
                            }
                        });
                    });
                }
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Container not found'
                });
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get real-time logs via Server-Sent Events
 */
router.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Get current container ID
    const getContainerCmd = spawn('docker', ['ps', '--filter', 'name=claude-code-daemon', '--format', '{{.ID}}']);
    let containerId = '';

    getContainerCmd.stdout.on('data', (data) => {
        containerId = data.toString().trim();
    });

    getContainerCmd.on('close', (code) => {
        if (code === 0 && containerId) {
            // Stream logs
            const logsCmd = spawn('docker', ['logs', '-f', '--tail=10', containerId]);

            logsCmd.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter(line => line.trim());
                lines.forEach(line => {
                    res.write(`data: ${JSON.stringify({type: 'log', message: line, timestamp: new Date()})}\n\n`);
                });
            });

            logsCmd.stderr.on('data', (data) => {
                const lines = data.toString().split('\n').filter(line => line.trim());
                lines.forEach(line => {
                    res.write(`data: ${JSON.stringify({type: 'error', message: line, timestamp: new Date()})}\n\n`);
                });
            });

            req.on('close', () => {
                logsCmd.kill();
            });
        } else {
            res.write(`data: ${JSON.stringify({type: 'error', message: 'Container not found'})}\n\n`);
            res.end();
        }
    });
});

/**
 * Get application logs from current process
 */
router.get('/app', (req, res) => {
    const limit = req.query.limit || 100;

    // This would typically read from a log file
    // For now, return recent console logs
    res.json({
        success: true,
        data: {
            message: 'Application logs would be available here',
            logs: [
                'Application started',
                'Server listening on port 5000',
                'Database connected'
            ]
        }
    });
});

module.exports = router;