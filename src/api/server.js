/**
 * Claude Code Daemon API Server
 * RESTful API and WebSocket server for dashboard
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');

const config = require('../daemon/config');
const NotificationService = require('../daemon/notification-service');
const usageRoutes = require('./routes/usage');
const alertsRoutes = require('./routes/alerts');
const systemRoutes = require('./routes/system');
const bmadRoutes = require('./routes/bmad');
const projectsRoutes = require('./routes/projects');
const nightModeRoutes = require('./routes/night-mode-simple');
const logsRoutes = require('./routes/logs');
const slackRoutes = require('./routes/slack');
const claudeRoutes = require('./routes/claude');
const { apiCorsMiddleware } = require('./middleware/cors');
const { requestLogger } = require('./middleware/logging');

class ApiServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: process.env.NODE_ENV === 'production' ? false : '*',
                methods: ['GET', 'POST']
            }
        });

        this.logger = winston.createLogger({
            level: config.logging.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/api.log' }),
                new winston.transports.Console()
            ]
        });

        this.notificationService = new NotificationService();
        this.initializeServices();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    async initializeServices() {
        try {
            await this.notificationService.initialize();
            this.logger.info('Notification service initialized');
        } catch (error) {
            this.logger.error('Failed to initialize notification service:', error);
        }
    }

    setupMiddleware() {
        // Security middleware
        if (process.env.NODE_ENV === 'production') {
            this.app.use(helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ['\'self\''],
                        styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https:'],
                        scriptSrc: ['\'self\'', 'https://cdn.jsdelivr.net'],
                        imgSrc: ['\'self\'', 'data:', 'https:'],
                        connectSrc: ['\'self\'', 'ws:', 'wss:']
                    }
                }
            }));
        } else {
            // Disable CSP in development for easier debugging
            this.app.use(helmet({
                contentSecurityPolicy: false
            }));
        }

        // CORS
        this.app.use(apiCorsMiddleware);

        // Compression
        this.app.use(compression());

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: process.env.NODE_ENV === 'development' ? 1000 : 100, // More lenient in development
            message: {
                success: false,
                error: 'Too many requests from this IP',
                code: 'RATE_LIMIT_EXCEEDED'
            }
        });
        this.app.use('/api/', limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Logging
        this.app.use(requestLogger(this.logger));

        // Static files
        this.app.use('/static', express.static(path.join(__dirname, '../web/public')));

        // View engine
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, '../web/views'));
    }

    setupRoutes() {
        // Inject notification service into Slack routes
        slackRoutes.setNotificationService(this.notificationService);

        // API routes
        this.app.use('/api/usage', usageRoutes);
        this.app.use('/api/alerts', alertsRoutes);
        this.app.use('/api/system', systemRoutes);
        this.app.use('/api/bmad', bmadRoutes);
        this.app.use('/api/projects', projectsRoutes);
        this.app.use('/api/night-mode', nightModeRoutes);
        this.app.use('/api/logs', logsRoutes);
        this.app.use('/api/slack', slackRoutes);
        this.app.use('/api', claudeRoutes);

        // Dashboard routes
        this.app.get('/', (req, res) => {
            res.render('dashboard', {
                title: 'Claude Code Daemon Dashboard',
                env: process.env.NODE_ENV,
                currentPage: 'dashboard'
            });
        });

        this.app.get('/usage', (req, res) => {
            res.render('usage', {
                title: 'Usage Analytics',
                env: process.env.NODE_ENV,
                currentPage: 'usage'
            });
        });

        this.app.get('/alerts', (req, res) => {
            res.render('alerts', {
                title: 'Alerts & Notifications',
                env: process.env.NODE_ENV,
                currentPage: 'alerts'
            });
        });

        this.app.get('/logs', (req, res) => {
            res.render('logs', {
                title: 'Container Logs',
                env: process.env.NODE_ENV,
                currentPage: 'logs'
            });
        });

        this.app.get('/slack-config', (req, res) => {
            res.render('slack-config', {
                title: 'Claude Code Daemon - Slack Configuration',
                env: process.env.NODE_ENV || 'development',
                currentPage: 'slack-config'
            });
        });

        this.app.get('/projects', (req, res) => {
            res.render('projects', {
                title: 'Project Management',
                env: process.env.NODE_ENV,
                currentPage: 'projects'
            });
        });

        // Project management routes
        this.app.get('/projects/create', (req, res) => {
            res.render('project-create', {
                title: 'Create New Project',
                env: process.env.NODE_ENV,
                currentPage: 'projects'
            });
        });

        this.app.get('/projects/import', (req, res) => {
            res.render('project-import', {
                title: 'Import Existing Project',
                env: process.env.NODE_ENV,
                currentPage: 'projects'
            });
        });

        this.app.get('/projects/clone', (req, res) => {
            res.render('project-clone', {
                title: 'Clone Repository',
                env: process.env.NODE_ENV,
                currentPage: 'projects'
            });
        });

        this.app.get('/projects/:id/edit', (req, res) => {
            res.render('project-edit', {
                title: 'Edit Project',
                env: process.env.NODE_ENV,
                currentPage: 'projects',
                projectId: req.params.id
            });
        });

        this.app.get('/workspace', (req, res) => {
            res.render('workspace', {
                title: 'Claude Code Workspace',
                env: process.env.NODE_ENV,
                currentPage: 'workspace'
            });
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('../../package.json').version
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.path} not found`
            });
        });
    }

    setupWebSocket() {
        // Make IO instance globally available for terminal streaming
        global.io = this.io;

        this.io.on('connection', (socket) => {
            this.logger.info(`Client connected: ${socket.id}`);

            socket.on('subscribe', (room) => {
                socket.join(room);
                this.logger.debug(`Client ${socket.id} subscribed to ${room}`);
            });

            socket.on('unsubscribe', (room) => {
                socket.leave(room);
                this.logger.debug(`Client ${socket.id} unsubscribed from ${room}`);
            });

            // Terminal input handling
            socket.on('terminal-input', (data) => {
                this.logger.debug(`Terminal input from ${socket.id}:`, data);
                // This will be handled by the projects routes
            });

            // Claude Code communication
            socket.on('claude-input', (data) => {
                this.logger.debug(`Claude input from ${socket.id}:`, data);
                // This will be handled by the projects routes
            });

            socket.on('disconnect', () => {
                this.logger.info(`Client disconnected: ${socket.id}`);
            });
        });

        // Real-time data broadcasting
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        // Only start timers in production or development mode
        if (process.env.NODE_ENV === 'test') {
            return;
        }

        // Broadcast usage updates every 30 seconds
        this.usageUpdateInterval = setInterval(() => {
            this.broadcastUsageUpdate();
        }, 30000);

        // Broadcast system status every 60 seconds
        this.systemStatusInterval = setInterval(() => {
            this.broadcastSystemStatus();
        }, 60000);
    }

    async broadcastUsageUpdate() {
        try {
            const usageData = await this.getCurrentUsageData();
            this.io.to('usage').emit('usage-update', usageData);
        } catch (error) {
            this.logger.error('Failed to broadcast usage update:', error);
        }
    }

    async broadcastSystemStatus() {
        try {
            const systemStatus = await this.getSystemStatus();
            this.io.to('system').emit('system-status', systemStatus);
        } catch (error) {
            this.logger.error('Failed to broadcast system status:', error);
        }
    }

    async getCurrentUsageData() {
        // Implementation to get current usage data
        const UsageMonitor = require('../daemon/usage-monitor');
        const monitor = new UsageMonitor();
        return await monitor.getCurrentUsage();
    }

    async getSystemStatus() {
        // Implementation to get system status
        return {
            cpu: process.cpuUsage(),
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            connections: this.io.engine.clientsCount
        };
    }

    setupErrorHandling() {
        this.app.use((error, req, res, _next) => {
            this.logger.error('API Error:', error);

            if (process.env.NODE_ENV === 'development') {
                res.status(500).json({
                    error: error.message,
                    stack: error.stack
                });
            } else {
                res.status(500).json({
                    error: 'Internal Server Error'
                });
            }
        });

        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught Exception:', error);
            this.shutdown();
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }

    start(port = process.env.PORT || 5000) {
        return new Promise((resolve, reject) => {
            this.server.listen(port, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                this.logger.info(`API Server started on port ${port}`);
                resolve();
            });
        });
    }

    shutdown() {
        this.logger.info('Shutting down API server');

        // Clear intervals
        if (this.usageUpdateInterval) {
            clearInterval(this.usageUpdateInterval);
        }
        if (this.systemStatusInterval) {
            clearInterval(this.systemStatusInterval);
        }

        this.server.close(() => {
            this.logger.info('API server shutdown complete');
            process.exit(0);
        });
    }

    // Method to broadcast alerts
    broadcastAlert(alert) {
        this.io.to('alerts').emit('alert', alert);
        this.logger.info('Alert broadcasted:', alert);
    }

    // Method to broadcast BMAD events
    broadcastBmadEvent(event) {
        this.io.to('bmad').emit('bmad-event', event);
        this.logger.debug('BMAD event broadcasted:', event);
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new ApiServer();

    server.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = ApiServer;
