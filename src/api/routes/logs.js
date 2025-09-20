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
        // Check if Docker is available (running inside container)
        const isInContainer = process.env.DATABASE_PATH && process.env.DATABASE_PATH.includes('/data');

        if (isInContainer) {
            // When running inside container, return application logs instead
            res.json({
                success: true,
                data: {
                    containerId: 'self',
                    logs: [
                        `[${new Date().toISOString()}] INFO: Application running inside container`,
                        `[${new Date().toISOString()}] INFO: Server listening on port 5000`,
                        `[${new Date().toISOString()}] INFO: Environment: ${process.env.NODE_ENV}`,
                        `[${new Date().toISOString()}] INFO: Database path: ${process.env.DATABASE_PATH}`,
                        `[${new Date().toISOString()}] INFO: Container logs available via: docker logs <container-id>`,
                        `[${new Date().toISOString()}] INFO: Use 'docker-compose logs claude-daemon' from host system`
                    ],
                    count: 6,
                    note: 'Docker commands not available inside container. Use docker-compose logs from host.'
                }
            });
            return;
        }

        // Get current container ID (only when running outside container)
        const getContainerCmd = spawn('docker', ['ps', '--filter', 'name=claude-code-daemon', '--format', '{{.ID}}']);
        let containerId = '';

        getContainerCmd.on('error', (error) => {
            res.status(503).json({
                success: false,
                error: 'Docker not available in this environment',
                message: 'Use docker-compose logs claude-daemon from the host system'
            });
        });

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

    // Check if Docker is available (running inside container)
    const isInContainer = process.env.DATABASE_PATH && process.env.DATABASE_PATH.includes('/data');

    if (isInContainer) {
        // When running inside container, provide status info instead
        res.write(`data: ${JSON.stringify({type: 'info', message: 'Application running inside container', timestamp: new Date()})}\n\n`);
        res.write(`data: ${JSON.stringify({type: 'info', message: 'Real-time container logs not available from inside container', timestamp: new Date()})}\n\n`);
        res.write(`data: ${JSON.stringify({type: 'info', message: 'Use: docker-compose logs -f claude-daemon (from host)', timestamp: new Date()})}\n\n`);

        // Send periodic heartbeat
        const heartbeat = setInterval(() => {
            res.write(`data: ${JSON.stringify({type: 'heartbeat', message: `Server running - ${new Date().toISOString()}`, timestamp: new Date()})}\n\n`);
        }, 5000);

        req.on('close', () => {
            clearInterval(heartbeat);
        });
        return;
    }

    // Get current container ID (only when running outside container)
    const getContainerCmd = spawn('docker', ['ps', '--filter', 'name=claude-code-daemon', '--format', '{{.ID}}']);
    let containerId = '';

    getContainerCmd.on('error', (error) => {
        res.write(`data: ${JSON.stringify({type: 'error', message: 'Docker not available in this environment', timestamp: new Date()})}\n\n`);
        res.end();
    });

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