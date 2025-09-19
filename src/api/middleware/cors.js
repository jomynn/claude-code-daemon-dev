/**
 * CORS Middleware
 * Configures Cross-Origin Resource Sharing for the API
 */

const cors = require('cors');

// Development CORS configuration
const developmentCorsOptions = {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-API-Key'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Rate-Limit-Limit',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
    ],
    credentials: true,
    maxAge: 86400 // 24 hours
};

// Production CORS configuration
const productionCorsOptions = {
    origin: function (origin, callback) {
        // Allow specific origins in production
        const allowedOrigins = [
            'https://claude-daemon.example.com',
            'https://dashboard.claude-daemon.example.com',
            'https://api.claude-daemon.example.com'
        ];

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {return callback(null, true);}

        // Check if origin is in allowed list
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count'
    ],
    credentials: true,
    maxAge: 3600 // 1 hour
};

// Test CORS configuration
const testCorsOptions = {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization'
    ],
    credentials: true
};

// Get CORS options based on environment
function getCorsOptions() {
    const env = process.env.NODE_ENV || 'development';

    switch (env) {
        case 'production':
            return productionCorsOptions;
        case 'test':
            return testCorsOptions;
        case 'development':
        default:
            return developmentCorsOptions;
    }
}

// Custom CORS middleware for WebSocket connections
const webSocketCorsMiddleware = (req, res, next) => {
    const origin = req.headers.origin;
    const env = process.env.NODE_ENV || 'development';

    if (env === 'development') {
        // Allow all origins in development
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else if (env === 'production') {
        // Check allowed origins in production
        const allowedOrigins = [
            'https://claude-daemon.example.com',
            'https://dashboard.claude-daemon.example.com'
        ];

        if (!origin || allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
        }
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    next();
};

// CORS error handler
const corsErrorHandler = (err, req, res, next) => {
    if (err && err.message && err.message.includes('CORS')) {
        return res.status(403).json({
            status: 'error',
            message: 'CORS policy violation',
            details: 'Origin not allowed by CORS policy',
            origin: req.headers.origin
        });
    }
    next(err);
};

// Preflight handler for complex requests
const preflightHandler = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        const method = req.headers['access-control-request-method'];
        const headers = req.headers['access-control-request-headers'];

        // Log preflight requests in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`CORS Preflight: ${origin} -> ${method} with headers: ${headers}`);
        }

        // Set preflight response headers
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');

        return res.status(204).end();
    }
    next();
};

// Dynamic CORS configuration based on request
const dynamicCorsMiddleware = (req, res, next) => {
    const corsOptions = getCorsOptions();

    // Add custom logic based on request path or headers
    if (req.path.startsWith('/api/webhook')) {
        // Allow webhooks from external services
        corsOptions.origin = true;
    }

    if (req.path.startsWith('/api/public')) {
        // Allow public API endpoints from any origin
        corsOptions.origin = true;
    }

    cors(corsOptions)(req, res, next);
};

// CORS configuration for specific routes
const apiCorsMiddleware = cors(getCorsOptions());

// CORS configuration for public routes (no restrictions)
const publicCorsMiddleware = cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: false
});

// CORS configuration for admin routes (strict)
const adminCorsMiddleware = cors({
    origin: function (origin, callback) {
        const env = process.env.NODE_ENV || 'development';

        if (env === 'development') {
            return callback(null, true);
        }

        // Only allow admin panel origins in production
        const adminOrigins = [
            'https://admin.claude-daemon.example.com'
        ];

        if (!origin || adminOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Admin access not allowed from this origin'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
});

module.exports = {
    apiCorsMiddleware,
    publicCorsMiddleware,
    adminCorsMiddleware,
    webSocketCorsMiddleware,
    dynamicCorsMiddleware,
    preflightHandler,
    corsErrorHandler,
    getCorsOptions
};
