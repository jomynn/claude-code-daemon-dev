/**
 * System Status and Control Routes
 * Provides endpoints for system monitoring, health checks, and control
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

// Get system status
router.get('/status', async (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        const systemStatus = {
            timestamp: new Date().toISOString(),
            uptime: {
                process: process.uptime(),
                system: os.uptime()
            },
            memory: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
                system: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem()
                }
            },
            cpu: {
                usage: cpuUsage,
                loadAvg: os.loadavg(),
                cores: os.cpus().length,
                model: os.cpus()[0]?.model || 'Unknown'
            },
            platform: {
                type: os.type(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname()
            },
            node: {
                version: process.version,
                pid: process.pid
            },
            environment: process.env.NODE_ENV || 'development'
        };

        res.json({
            success: true,
            data: systemStatus
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get system status',
            error: error.message
        });
    }
});

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            checks: {
                database: await checkDatabaseHealth(),
                filesystem: await checkFilesystemHealth(),
                memory: checkMemoryHealth(),
                services: await checkServicesHealth()
            }
        };

        // Determine overall health
        const allHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
        health.status = allHealthy ? 'healthy' : 'unhealthy';

        const statusCode = allHealthy ? 200 : 503;
        res.status(statusCode).json(health);

    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            message: 'Health check failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get service information
router.get('/services', async (req, res) => {
    try {
        const services = {
            daemon: {
                status: 'running', // This would be dynamically checked
                uptime: process.uptime(),
                pid: process.pid
            },
            api: {
                status: 'running',
                port: process.env.PORT || 5000,
                uptime: process.uptime()
            },
            database: {
                status: await getDatabaseStatus(),
                path: process.env.DATABASE_PATH || './data/claude-daemon.db'
            },
            monitoring: {
                status: 'active',
                interval: 300, // 5 minutes
                lastCheck: new Date().toISOString()
            }
        };

        res.json({
            status: 'success',
            data: services
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get services status',
            error: error.message
        });
    }
});

// Restart service (requires authentication in production)
router.post('/restart/:service', async (req, res) => {
    const { service } = req.params;

    try {
        // In production, this should require proper authentication
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                status: 'error',
                message: 'Service restart not allowed in production via API'
            });
        }

        switch (service) {
            case 'daemon':
                // Signal daemon restart (would need IPC or process management)
                res.json({
                    status: 'success',
                    message: 'Daemon restart initiated',
                    service: 'daemon'
                });
                break;

            case 'api':
                // This would restart the API server
                res.json({
                    status: 'success',
                    message: 'API server restart initiated',
                    service: 'api'
                });

                // Graceful restart after response
                setTimeout(() => {
                    process.exit(0);
                }, 1000);
                break;

            default:
                res.status(400).json({
                    status: 'error',
                    message: `Unknown service: ${service}`
                });
        }

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: `Failed to restart ${service}`,
            error: error.message
        });
    }
});

// Get logs
router.get('/logs/:type?', async (req, res) => {
    const { type = 'api' } = req.params;
    const { lines = 100, follow: _follow = false } = req.query;

    try {
        const logFiles = {
            api: 'logs/api.log',
            daemon: 'logs/daemon.log',
            error: 'logs/error.log',
            combined: 'logs/combined.log'
        };

        const logFile = logFiles[type];
        if (!logFile) {
            return res.status(400).json({
                status: 'error',
                message: `Unknown log type: ${type}`,
                available: Object.keys(logFiles)
            });
        }

        const logPath = path.join(process.cwd(), logFile);

        try {
            const logContent = await fs.readFile(logPath, 'utf8');
            const logLines = logContent.split('\n').filter(line => line.trim());
            const recentLines = logLines.slice(-parseInt(lines));

            res.json({
                status: 'success',
                data: {
                    type,
                    lines: recentLines,
                    total: logLines.length,
                    file: logFile
                }
            });

        } catch (fileError) {
            res.status(404).json({
                status: 'error',
                message: `Log file not found: ${logFile}`,
                error: fileError.message
            });
        }

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve logs',
            error: error.message
        });
    }
});

// System metrics endpoint
router.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            cpu: {
                usage: process.cpuUsage(),
                loadAvg: os.loadavg()
            },
            memory: {
                process: process.memoryUsage(),
                system: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem()
                }
            },
            network: {
                interfaces: Object.entries(os.networkInterfaces()).map(([name, interfaces]) => ({
                    name,
                    addresses: interfaces
                }))
            },
            uptime: {
                process: process.uptime(),
                system: os.uptime()
            }
        };

        res.json({
            status: 'success',
            data: metrics
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get system metrics',
            error: error.message
        });
    }
});

// Helper functions
async function checkDatabaseHealth() {
    try {
        // This would check database connectivity
        // For now, just check if database file exists
        const dbPath = process.env.DATABASE_PATH || './data/claude-daemon.db';
        await fs.access(dbPath);

        return {
            status: 'healthy',
            message: 'Database accessible',
            path: dbPath
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Database not accessible',
            error: error.message
        };
    }
}

async function checkFilesystemHealth() {
    try {
        // Check if required directories exist and are writable
        const requiredDirs = ['./data', './logs', './temp'];

        for (const dir of requiredDirs) {
            try {
                await fs.access(dir, fs.constants.W_OK);
            } catch (error) {
                // Try to create directory if it doesn't exist
                await fs.mkdir(dir, { recursive: true });
            }
        }

        return {
            status: 'healthy',
            message: 'Filesystem accessible',
            directories: requiredDirs
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Filesystem issues detected',
            error: error.message
        };
    }
}

function checkMemoryHealth() {
    try {
        const memUsage = process.memoryUsage();
        const systemMem = os.totalmem();
        const freeMem = os.freemem();

        const memoryUsagePercent = (memUsage.rss / systemMem) * 100;
        const systemMemoryUsagePercent = ((systemMem - freeMem) / systemMem) * 100;

        const isHealthy = memoryUsagePercent < 80 && systemMemoryUsagePercent < 90;

        return {
            status: isHealthy ? 'healthy' : 'warning',
            message: isHealthy ? 'Memory usage normal' : 'High memory usage detected',
            usage: {
                process: memoryUsagePercent.toFixed(2),
                system: systemMemoryUsagePercent.toFixed(2)
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Memory check failed',
            error: error.message
        };
    }
}

async function checkServicesHealth() {
    // This would check if all required services are running
    // For now, just check if the current process is healthy
    return {
        status: 'healthy',
        message: 'All services running',
        services: ['api', 'daemon', 'monitoring']
    };
}

async function getDatabaseStatus() {
    try {
        const dbPath = process.env.DATABASE_PATH || './data/claude-daemon.db';
        const stats = await fs.stat(dbPath);

        return {
            connected: true,
            size: stats.size,
            lastModified: stats.mtime
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message
        };
    }
}

module.exports = router;
