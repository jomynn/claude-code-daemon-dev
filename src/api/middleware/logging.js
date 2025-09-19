/**
 * Logging Middleware
 * Provides comprehensive logging for API requests and responses
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'claude-daemon-api' },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // API-specific log file
        new winston.transports.File({
            filename: path.join(logsDir, 'api.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })
        )
    }));
}

// Request logging middleware
const requestLogger = (logger) => {
    return (req, res, next) => {
        const startTime = Date.now();

        // Generate request ID
        req.requestId = generateRequestId();

        // Log request start
        const requestData = {
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            originalUrl: req.originalUrl,
            path: req.path,
            query: req.query,
            headers: sanitizeHeaders(req.headers),
            ip: getClientIp(req),
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
            userId: req.user?.id,
            username: req.user?.username
        };

        // Log body for POST/PUT/PATCH requests (sanitized)
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            requestData.body = sanitizeBody(req.body);
        }

        logger.info('Request started', requestData);

        // Capture original res.json and res.send
        const originalJson = res.json;
        const originalSend = res.send;

        let responseBody = null;

        res.json = function (data) {
            responseBody = data;
            return originalJson.call(this, data);
        };

        res.send = function (data) {
            if (!responseBody) {
                responseBody = data;
            }
            return originalSend.call(this, data);
        };

        // Log response when finished
        res.on('finish', () => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            const responseData = {
                requestId: req.requestId,
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                duration: `${duration}ms`,
                contentLength: res.get('Content-Length'),
                timestamp: new Date().toISOString(),
                responseBody: sanitizeResponseBody(responseBody, res.statusCode)
            };

            // Log based on status code
            if (res.statusCode >= 400) {
                logger.error('Request completed with error', { ...requestData, ...responseData });
            } else if (res.statusCode >= 300) {
                logger.warn('Request redirected', { ...requestData, ...responseData });
            } else {
                logger.info('Request completed successfully', { ...requestData, ...responseData });
            }

            // Performance logging
            if (duration > 1000) {
                logger.warn('Slow request detected', {
                    requestId: req.requestId,
                    method: req.method,
                    url: req.url,
                    duration: `${duration}ms`,
                    threshold: '1000ms'
                });
            }
        });

        // Log errors
        res.on('error', (error) => {
            logger.error('Response error', {
                requestId: req.requestId,
                error: error.message,
                stack: error.stack
            });
        });

        next();
    };
};

// Error logging middleware
const errorLogger = (logger) => {
    return (err, req, res, next) => {
        const errorData = {
            requestId: req.requestId,
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack,
                code: err.code,
                status: err.status || err.statusCode
            },
            request: {
                method: req.method,
                url: req.url,
                headers: sanitizeHeaders(req.headers),
                body: sanitizeBody(req.body),
                query: req.query,
                params: req.params
            },
            user: req.user ? {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            } : null,
            timestamp: new Date().toISOString()
        };

        // Log error with appropriate level
        if (err.status >= 500 || !err.status) {
            logger.error('Internal server error', errorData);
        } else if (err.status >= 400) {
            logger.warn('Client error', errorData);
        } else {
            logger.info('Application error', errorData);
        }

        next(err);
    };
};

// Security logging middleware
const securityLogger = (logger) => {
    return (req, res, next) => {
        // Log suspicious activities
        const suspiciousPatterns = [
            /\.\./,  // Path traversal
            /<script/i, // XSS attempts
            /union.*select/i, // SQL injection
            /eval\(/i, // Code injection
            /javascript:/i // JavaScript protocol
        ];

        const userInput = JSON.stringify({
            url: req.url,
            query: req.query,
            body: req.body,
            headers: req.headers
        });

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(userInput)) {
                logger.warn('Suspicious request detected', {
                    requestId: req.requestId,
                    pattern: pattern.toString(),
                    ip: getClientIp(req),
                    userAgent: req.get('User-Agent'),
                    url: req.url,
                    method: req.method,
                    timestamp: new Date().toISOString()
                });
                break;
            }
        }

        // Log authentication failures
        if (req.path.includes('/login') && req.method === 'POST') {
            res.on('finish', () => {
                if (res.statusCode === 401) {
                    logger.warn('Authentication failure', {
                        ip: getClientIp(req),
                        userAgent: req.get('User-Agent'),
                        username: req.body?.username,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        }

        next();
    };
};

// Performance monitoring middleware
const performanceLogger = (logger) => {
    return (req, res, next) => {
        const startTime = process.hrtime();

        res.on('finish', () => {
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

            // Log slow requests
            if (duration > 500) {
                logger.warn('Performance issue detected', {
                    requestId: req.requestId,
                    method: req.method,
                    url: req.url,
                    duration: `${duration.toFixed(2)}ms`,
                    statusCode: res.statusCode
                });
            }

            // Log performance metrics every 100 requests
            if (Math.random() < 0.01) {
                const memUsage = process.memoryUsage();
                logger.info('Performance metrics', {
                    memory: {
                        rss: Math.round(memUsage.rss / 1024 / 1024),
                        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
                    },
                    uptime: Math.round(process.uptime()),
                    timestamp: new Date().toISOString()
                });
            }
        });

        next();
    };
};

// Helper functions
function generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getClientIp(req) {
    return req.ip ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'];
}

function sanitizeHeaders(headers) {
    const sanitized = { ...headers };

    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];

    return sanitized;
}

function sanitizeBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
}

function sanitizeResponseBody(body, statusCode) {
    // Don't log response body for successful requests to reduce log size
    if (statusCode >= 200 && statusCode < 300) {
        return '[SUCCESS_RESPONSE]';
    }

    // Log error response bodies but sanitize sensitive data
    if (typeof body === 'object' && body !== null) {
        const sanitized = { ...body };

        if (sanitized.token) {
            sanitized.token = '[REDACTED]';
        }

        return sanitized;
    }

    return body;
}

// Main logging middleware factory
function createLoggingMiddleware(customLogger = null) {
    const loggerInstance = customLogger || logger;

    return [
        requestLogger(loggerInstance),
        securityLogger(loggerInstance),
        performanceLogger(loggerInstance)
    ];
}

module.exports = {
    logger,
    requestLogger,
    errorLogger,
    securityLogger,
    performanceLogger,
    createLoggingMiddleware
};
