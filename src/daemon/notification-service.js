/**
 * Notification Service Module
 * Handles alerts and notifications across multiple channels
 */

const EventEmitter = require('events');
const nodemailer = require('nodemailer');
const axios = require('axios');
const winston = require('winston');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.channels = new Map();
        this.alertHistory = [];
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/notifications.log' }),
                new winston.transports.Console()
            ]
        });
    }

    async initialize() {
        // Initialize notification channels based on configuration
        if (process.env.EMAIL_HOST) {
            this.setupEmailChannel();
        }

        if (process.env.SLACK_WEBHOOK) {
            this.setupSlackChannel();
        }

        if (process.env.WEBHOOK_URL) {
            this.setupWebhookChannel();
        }

        // Always setup console channel
        this.setupConsoleChannel();

        this.logger.info('Notification service initialized with channels:', Array.from(this.channels.keys()));
    }

    setupEmailChannel() {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        this.channels.set('email', {
            type: 'email',
            send: async (alert) => {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: process.env.EMAIL_TO || process.env.EMAIL_USER,
                    subject: `Claude Daemon Alert: ${alert.type}`,
                    html: this.formatEmailAlert(alert)
                };

                try {
                    await transporter.sendMail(mailOptions);
                    this.logger.info('Email alert sent successfully');
                } catch (error) {
                    this.logger.error('Failed to send email alert:', error);
                    throw error;
                }
            }
        });
    }

    setupSlackChannel() {
        this.channels.set('slack', {
            type: 'slack',
            send: async (alert) => {
                const payload = {
                    text: `Claude Daemon Alert`,
                    attachments: [{
                        color: this.getAlertColor(alert.severity),
                        title: alert.type,
                        text: alert.message,
                        fields: this.formatSlackFields(alert.data),
                        footer: 'Claude Code Daemon',
                        ts: Math.floor(Date.now() / 1000)
                    }]
                };

                try {
                    await axios.post(process.env.SLACK_WEBHOOK, payload);
                    this.logger.info('Slack alert sent successfully');
                } catch (error) {
                    this.logger.error('Failed to send Slack alert:', error);
                    throw error;
                }
            }
        });
    }

    setupWebhookChannel() {
        this.channels.set('webhook', {
            type: 'webhook',
            send: async (alert) => {
                try {
                    await axios.post(process.env.WEBHOOK_URL, {
                        timestamp: new Date().toISOString(),
                        ...alert
                    });
                    this.logger.info('Webhook alert sent successfully');
                } catch (error) {
                    this.logger.error('Failed to send webhook alert:', error);
                    throw error;
                }
            }
        });
    }

    setupConsoleChannel() {
        this.channels.set('console', {
            type: 'console',
            send: async (alert) => {
                const colors = {
                    info: '\x1b[34m',
                    warning: '\x1b[33m',
                    critical: '\x1b[31m',
                    success: '\x1b[32m'
                };
                const reset = '\x1b[0m';
                const color = colors[alert.severity] || reset;

                console.log(`${color}[${alert.severity.toUpperCase()}]${reset} ${alert.type}: ${alert.message}`);

                if (alert.data) {
                    console.log('Details:', JSON.stringify(alert.data, null, 2));
                }
            }
        });
    }

    async sendAlert(alert) {
        // Add timestamp if not present
        alert.timestamp = alert.timestamp || new Date().toISOString();

        // Store in history
        this.alertHistory.push(alert);
        if (this.alertHistory.length > 1000) {
            this.alertHistory.shift(); // Keep last 1000 alerts
        }

        // Send to all configured channels
        const promises = [];
        for (const [name, channel] of this.channels.entries()) {
            if (this.shouldSendToChannel(alert, name)) {
                promises.push(
                    channel.send(alert).catch(error => {
                        this.logger.error(`Failed to send alert via ${name}:`, error);
                    })
                );
            }
        }

        await Promise.all(promises);

        // Emit alert event
        this.emit('alert-sent', alert);
    }

    shouldSendToChannel(alert, channelName) {
        // Implement channel-specific filtering logic
        if (channelName === 'console') {
            return true; // Always log to console
        }

        if (alert.severity === 'critical') {
            return true; // Send critical alerts to all channels
        }

        if (alert.severity === 'warning' && channelName !== 'email') {
            return true; // Send warnings to all except email
        }

        if (alert.severity === 'info' && channelName === 'console') {
            return true; // Info only to console
        }

        return false;
    }

    formatEmailAlert(alert) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .alert-container {
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        padding: 20px;
                        margin: 20px;
                    }
                    .alert-header {
                        font-size: 18px;
                        font-weight: bold;
                        color: ${this.getAlertColorHex(alert.severity)};
                        margin-bottom: 10px;
                    }
                    .alert-message {
                        margin: 10px 0;
                    }
                    .alert-data {
                        background-color: #f5f5f5;
                        padding: 10px;
                        border-radius: 3px;
                        font-family: monospace;
                    }
                    .alert-footer {
                        margin-top: 20px;
                        font-size: 12px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="alert-container">
                    <div class="alert-header">${alert.type}</div>
                    <div class="alert-message">${alert.message}</div>
                    ${alert.data ? `<div class="alert-data"><pre>${JSON.stringify(alert.data, null, 2)}</pre></div>` : ''}
                    <div class="alert-footer">
                        Timestamp: ${alert.timestamp}<br>
                        Severity: ${alert.severity}<br>
                        Source: Claude Code Daemon
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    formatSlackFields(data) {
        if (!data) {return [];}

        return Object.entries(data).map(([key, value]) => ({
            title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            short: String(value).length < 30
        }));
    }

    getAlertColor(severity) {
        const colors = {
            info: '#36a64f',
            warning: '#ff9900',
            critical: '#ff0000',
            success: '#00ff00'
        };
        return colors[severity] || '#808080';
    }

    getAlertColorHex(severity) {
        const colors = {
            info: '#2196F3',
            warning: '#FF9800',
            critical: '#F44336',
            success: '#4CAF50'
        };
        return colors[severity] || '#9E9E9E';
    }

    async testNotifications() {
        const testAlert = {
            type: 'test',
            severity: 'info',
            message: 'This is a test notification from Claude Code Daemon',
            data: {
                test: true,
                timestamp: new Date().toISOString()
            }
        };

        await this.sendAlert(testAlert);
        this.logger.info('Test notifications sent');
    }

    getRecentAlerts(limit = 100) {
        return this.alertHistory.slice(-limit);
    }

    clearAlertHistory() {
        const count = this.alertHistory.length;
        this.alertHistory = [];
        this.logger.info(`Cleared ${count} alerts from history`);
        return count;
    }

    async cleanup() {
        // Cleanup any resources
        this.channels.clear();
        this.alertHistory = [];
        this.logger.info('Notification service cleaned up');
    }

    getStatus() {
        return {
            channels: Array.from(this.channels.keys()),
            alertHistorySize: this.alertHistory.length,
            recentAlerts: this.alertHistory.slice(-5).map(a => ({
                type: a.type,
                severity: a.severity,
                timestamp: a.timestamp
            }))
        };
    }

    // Method to add custom notification channel
    addChannel(name, channel) {
        if (typeof channel.send !== 'function') {
            throw new Error('Channel must have a send method');
        }
        this.channels.set(name, channel);
        this.logger.info(`Added custom channel: ${name}`);
    }

    // Method to remove notification channel
    removeChannel(name) {
        if (this.channels.delete(name)) {
            this.logger.info(`Removed channel: ${name}`);
            return true;
        }
        return false;
    }

    // Method to update alert severity thresholds
    updateSeverityThresholds(thresholds) {
        this.severityThresholds = thresholds;
        this.logger.info('Updated severity thresholds:', thresholds);
    }
}

module.exports = NotificationService;
