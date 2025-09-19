/**
 * Authentication Middleware
 * Handles JWT authentication and authorization
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT secret key (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Mock user database (in production, this would be in a real database)
const users = new Map([
    ['admin', {
        id: 1,
        username: 'admin',
        email: 'admin@claude-daemon.local',
        password: '$2a$10$8K1p/a0dRTCBRfYN2Bw4eOVNYYQ9bQl.ZYyJD8tZc4EIBuQW3Qb/2', // 'admin123'
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
        createdAt: new Date().toISOString()
    }],
    ['user', {
        id: 2,
        username: 'user',
        email: 'user@claude-daemon.local',
        password: '$2a$10$8K1p/a0dRTCBRfYN2Bw4eOVNYYQ9bQl.ZYyJD8tZc4EIBuQW3Qb/2', // 'user123'
        role: 'user',
        permissions: ['read'],
        createdAt: new Date().toISOString()
    }]
]);

// Authentication middleware
const authenticate = (req, res, next) => {
    try {
        // Skip authentication in development mode if specified
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
            req.user = { id: 1, username: 'dev', role: 'admin', permissions: ['read', 'write', 'admin'] };
            return next();
        }

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                status: 'error',
                message: 'No authorization header provided'
            });
        }

        const token = authHeader.split(' ')[1]; // Bearer <token>

        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'No token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = getUserById(decoded.id);

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token - user not found'
            });
        }

        // Add user to request object
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            permissions: user.permissions
        };

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token expired'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Authentication error',
            error: error.message
        });
    }
};

// Authorization middleware
const authorize = (permissions = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'User not authenticated'
            });
        }

        // Admin has all permissions
        if (req.user.role === 'admin') {
            return next();
        }

        // Check if user has required permissions
        const hasPermission = permissions.every(permission =>
            req.user.permissions.includes(permission)
        );

        if (!hasPermission) {
            return res.status(403).json({
                status: 'error',
                message: 'Insufficient permissions',
                required: permissions,
                current: req.user.permissions
            });
        }

        next();
    };
};

// Role-based authorization
const requireRole = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'User not authenticated'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Insufficient role',
                required: roles,
                current: req.user.role
            });
        }

        next();
    };
};

// Login endpoint
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Username and password are required'
            });
        }

        // Find user
        const user = getUserByUsername(username);

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Update last login
        user.lastLogin = new Date().toISOString();

        res.json({
            status: 'success',
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions
                },
                expiresIn: JWT_EXPIRES_IN
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Login failed',
            error: error.message
        });
    }
};

// Logout endpoint
const logout = (req, res) => {
    // In a real application, you might want to blacklist the token
    res.json({
        status: 'success',
        message: 'Logout successful'
    });
};

// Get current user
const getCurrentUser = (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            status: 'error',
            message: 'User not authenticated'
        });
    }

    res.json({
        status: 'success',
        data: req.user
    });
};

// Change password
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'New password must be at least 6 characters long'
            });
        }

        const user = getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Verify current password
        const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);

        if (!isValidCurrentPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedNewPassword;
        user.updatedAt = new Date().toISOString();

        res.json({
            status: 'success',
            message: 'Password changed successfully'
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to change password',
            error: error.message
        });
    }
};

// Generate API key
const generateApiKey = (req, res) => {
    try {
        const apiKey = jwt.sign(
            {
                id: req.user.id,
                username: req.user.username,
                type: 'api_key',
                role: req.user.role
            },
            JWT_SECRET,
            { expiresIn: '365d' } // API keys last longer
        );

        res.json({
            status: 'success',
            message: 'API key generated successfully',
            data: {
                apiKey,
                expiresIn: '365d',
                note: 'Store this API key securely. It will not be shown again.'
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate API key',
            error: error.message
        });
    }
};

// Helper functions
function getUserById(id) {
    for (const user of users.values()) {
        if (user.id === id) {
            return user;
        }
    }
    return null;
}

function getUserByUsername(username) {
    return users.get(username);
}

// Rate limiting for authentication endpoints
const authRateLimit = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        status: 'error',
        message: 'Too many authentication attempts, please try again later'
    }
};

module.exports = {
    authenticate,
    authorize,
    requireRole,
    login,
    logout,
    getCurrentUser,
    changePassword,
    generateApiKey,
    authRateLimit
};
