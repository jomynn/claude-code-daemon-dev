/**
 * Enhanced Slack Integration Service
 * Provides bot functionality and custom channel management for Claude Code Daemon
 */

const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const EventEmitter = require('events');
const winston = require('winston');

class SlackService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            botToken: process.env.SLACK_BOT_TOKEN,
            appToken: process.env.SLACK_APP_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
            channels: {
                alerts: process.env.SLACK_ALERTS_CHANNEL || '#claude-alerts',
                status: process.env.SLACK_STATUS_CHANNEL || '#claude-status',
                commands: process.env.SLACK_COMMANDS_CHANNEL || '#claude-control',
                general: process.env.SLACK_GENERAL_CHANNEL || '#claude-general'
            },
            ...config
        };

        this.app = null;
        this.webClient = null;
        this.isInitialized = false;
        this.channelIds = new Map();

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/slack.log' }),
                new winston.transports.Console()
            ]
        });
    }

    async initialize() {
        if (!this.config.botToken) {
            this.logger.warn('Slack bot token not provided. Slack bot functionality disabled.');
            return false;
        }

        try {
            // Initialize Slack App with Socket Mode for real-time events
            this.app = new App({
                token: this.config.botToken,
                appToken: this.config.appToken,
                signingSecret: this.config.signingSecret,
                socketMode: true,
                logLevel: 'info'
            });

            this.webClient = new WebClient(this.config.botToken);

            // Set up command handlers
            this.setupCommands();
            this.setupEventHandlers();

            // Start the app
            await this.app.start();

            // Cache channel IDs
            await this.cacheChannelIds();

            this.isInitialized = true;
            this.logger.info('Slack service initialized successfully');
            this.emit('initialized');

            return true;
        } catch (error) {
            this.logger.error('Failed to initialize Slack service:', error);
            return false;
        }
    }

    async cacheChannelIds() {
        try {
            const channels = await this.webClient.conversations.list({
                types: 'public_channel,private_channel'
            });

            for (const [configKey, channelName] of Object.entries(this.config.channels)) {
                const cleanChannelName = channelName.replace('#', '');
                const channel = channels.channels.find(ch =>
                    ch.name === cleanChannelName || ch.id === channelName
                );

                if (channel) {
                    this.channelIds.set(configKey, channel.id);
                    this.logger.info(`Cached channel ID for ${configKey}: ${channel.id}`);
                } else {
                    this.logger.warn(`Channel not found: ${channelName}`);
                }
            }
        } catch (error) {
            this.logger.error('Failed to cache channel IDs:', error);
        }
    }

    setupCommands() {
        // Help command
        this.app.command('/claude-help', async ({ command, ack, say }) => {
            await ack();

            const helpText = `
*Claude Code Daemon Commands:* 🤖

\`/claude-status\` - Get system status and health
\`/claude-projects\` - List all projects
\`/claude-start [project-name]\` - Start Claude Code for a project
\`/claude-stop [project-name]\` - Stop Claude Code for a project
\`/claude-bmad [project-name] [workflow]\` - Start BMAD workflow
\`/claude-logs [lines]\` - Get recent logs (default: 10 lines)
\`/claude-alerts\` - Get recent alerts
\`/claude-usage\` - Get usage statistics
\`/claude-health\` - Perform health check
\`/claude-channels\` - Configure notification channels

*Examples:*
\`/claude-start my-project\`
\`/claude-bmad startup-app agile\`
\`/claude-logs 20\`
            `;

            await say(helpText);
        });

        // Status command
        this.app.command('/claude-status', async ({ command, ack, say }) => {
            await ack();

            try {
                const status = await this.getSystemStatus();
                await say({
                    blocks: this.formatStatusBlocks(status)
                });
            } catch (error) {
                await say(`❌ Error getting status: ${error.message}`);
            }
        });

        // Projects command
        this.app.command('/claude-projects', async ({ command, ack, say }) => {
            await ack();

            try {
                const projects = await this.getProjects();
                await say({
                    blocks: this.formatProjectsBlocks(projects)
                });
            } catch (error) {
                await say(`❌ Error getting projects: ${error.message}`);
            }
        });

        // Start Claude command
        this.app.command('/claude-start', async ({ command, ack, say }) => {
            await ack();

            const projectName = command.text.trim();
            if (!projectName) {
                await say('❌ Please specify a project name: `/claude-start [project-name]`');
                return;
            }

            try {
                const result = await this.startClaude(projectName);
                await say(`✅ Claude Code started for project: *${projectName}*`);
                this.emit('claude-started', { project: projectName, user: command.user_id });
            } catch (error) {
                await say(`❌ Failed to start Claude Code: ${error.message}`);
            }
        });

        // Stop Claude command
        this.app.command('/claude-stop', async ({ command, ack, say }) => {
            await ack();

            const projectName = command.text.trim();
            if (!projectName) {
                await say('❌ Please specify a project name: `/claude-stop [project-name]`');
                return;
            }

            try {
                await this.stopClaude(projectName);
                await say(`⏹️ Claude Code stopped for project: *${projectName}*`);
                this.emit('claude-stopped', { project: projectName, user: command.user_id });
            } catch (error) {
                await say(`❌ Failed to stop Claude Code: ${error.message}`);
            }
        });

        // BMAD workflow command
        this.app.command('/claude-bmad', async ({ command, ack, say }) => {
            await ack();

            const params = command.text.split(' ');
            const projectName = params[0];
            const workflow = params[1] || 'agile';

            if (!projectName) {
                await say('❌ Please specify a project name: `/claude-bmad [project-name] [workflow]`');
                return;
            }

            try {
                await this.startBmad(projectName, workflow);
                await say(`⚡ BMAD workflow (*${workflow}*) started for project: *${projectName}*`);
                this.emit('bmad-started', { project: projectName, workflow, user: command.user_id });
            } catch (error) {
                await say(`❌ Failed to start BMAD: ${error.message}`);
            }
        });

        // Logs command
        this.app.command('/claude-logs', async ({ command, ack, say }) => {
            await ack();

            const lines = parseInt(command.text.trim()) || 10;

            try {
                const logs = await this.getLogs(lines);
                await say({
                    blocks: this.formatLogsBlocks(logs, lines)
                });
            } catch (error) {
                await say(`❌ Error getting logs: ${error.message}`);
            }
        });

        // Usage command
        this.app.command('/claude-usage', async ({ command, ack, say }) => {
            await ack();

            try {
                const usage = await this.getUsageStats();
                await say({
                    blocks: this.formatUsageBlocks(usage)
                });
            } catch (error) {
                await say(`❌ Error getting usage stats: ${error.message}`);
            }
        });

        // Health check command
        this.app.command('/claude-health', async ({ command, ack, say }) => {
            await ack();

            try {
                const health = await this.performHealthCheck();
                await say({
                    blocks: this.formatHealthBlocks(health)
                });
            } catch (error) {
                await say(`❌ Health check failed: ${error.message}`);
            }
        });
    }

    setupEventHandlers() {
        // Handle mentions
        this.app.event('app_mention', async ({ event, say }) => {
            const text = event.text.toLowerCase();

            if (text.includes('status')) {
                const status = await this.getSystemStatus();
                await say({
                    blocks: this.formatStatusBlocks(status)
                });
            } else if (text.includes('help')) {
                await say('Hi! 👋 Use `/claude-help` to see all available commands.');
            } else {
                await say('Hi! 👋 I\'m the Claude Code Daemon bot. Use `/claude-help` to see what I can do!');
            }
        });

        // Handle direct messages
        this.app.message(async ({ message, say }) => {
            if (message.channel_type === 'im') {
                await say('Hi! 👋 Use `/claude-help` to see all available commands, or mention me in a channel!');
            }
        });
    }

    // Notification methods for different types of messages
    async sendAlert(alert, channelKey = 'alerts') {
        if (!this.isInitialized) return false;

        const channelId = this.channelIds.get(channelKey);
        if (!channelId) {
            this.logger.warn(`Channel not configured: ${channelKey}`);
            return false;
        }

        try {
            const blocks = this.formatAlertBlocks(alert);
            await this.webClient.chat.postMessage({
                channel: channelId,
                blocks: blocks,
                text: `Alert: ${alert.type}` // Fallback text
            });

            this.logger.info(`Alert sent to Slack channel: ${channelKey}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send Slack alert:', error);
            return false;
        }
    }

    async sendStatusUpdate(status, channelKey = 'status') {
        if (!this.isInitialized) return false;

        const channelId = this.channelIds.get(channelKey);
        if (!channelId) return false;

        try {
            const blocks = this.formatStatusBlocks(status);
            await this.webClient.chat.postMessage({
                channel: channelId,
                blocks: blocks,
                text: 'System Status Update'
            });

            return true;
        } catch (error) {
            this.logger.error('Failed to send status update:', error);
            return false;
        }
    }

    async sendCustomMessage(message, channelKey = 'general', options = {}) {
        if (!this.isInitialized) return false;

        const channelId = this.channelIds.get(channelKey);
        if (!channelId) return false;

        try {
            await this.webClient.chat.postMessage({
                channel: channelId,
                text: message,
                ...options
            });

            return true;
        } catch (error) {
            this.logger.error('Failed to send custom message:', error);
            return false;
        }
    }

    // Message formatting methods
    formatAlertBlocks(alert) {
        const color = this.getAlertColor(alert.severity);
        const emoji = this.getAlertEmoji(alert.severity);

        return [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `${emoji} *${alert.type}*\n${alert.message}`
                }
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: `*Severity:* ${alert.severity} | *Time:* ${new Date(alert.timestamp).toLocaleString()}`
                    }
                ]
            },
            ...(alert.data ? [{
                type: 'section',
                fields: Object.entries(alert.data).map(([key, value]) => ({
                    type: 'mrkdwn',
                    text: `*${key}:*\n${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`
                }))
            }] : [])
        ];
    }

    formatStatusBlocks(status) {
        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '🤖 Claude Code Daemon Status'
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Status:* ${status.running ? '🟢 Running' : '🔴 Stopped'}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Uptime:* ${status.uptime || 'N/A'}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Memory:* ${status.memory || 'N/A'}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Active Projects:* ${status.activeProjects || 0}`
                    }
                ]
            }
        ];
    }

    formatProjectsBlocks(projects) {
        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '📁 Projects Overview'
                }
            },
            ...projects.slice(0, 10).map(project => ({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*${project.name}*\n${project.description || 'No description'}`
                },
                accessory: {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: project.status === 'active' ? 'Stop' : 'Start'
                    },
                    action_id: `project_${project.status === 'active' ? 'stop' : 'start'}_${project.id}`
                }
            })),
            ...(projects.length > 10 ? [{
                type: 'context',
                elements: [{
                    type: 'mrkdwn',
                    text: `Showing 10 of ${projects.length} projects. Use the dashboard for full list.`
                }]
            }] : [])
        ];
    }

    formatLogsBlocks(logs, lines) {
        const logText = logs.slice(-lines).join('\n');

        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `📋 Recent Logs (${lines} lines)`
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `\`\`\`${logText}\`\`\``
                }
            }
        ];
    }

    formatUsageBlocks(usage) {
        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '📊 Usage Statistics'
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Total Requests:* ${usage.totalRequests || 0}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Total Tokens:* ${usage.totalTokens || 0}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Requests/Hour:* ${usage.requestsPerHour || 0}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Success Rate:* ${usage.successRate || 0}%`
                    }
                ]
            }
        ];
    }

    formatHealthBlocks(health) {
        const healthEmoji = health.overall === 'healthy' ? '🟢' : '🟡';

        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `${healthEmoji} Health Check Results`
                }
            },
            {
                type: 'section',
                fields: Object.entries(health.services || {}).map(([service, status]) => ({
                    type: 'mrkdwn',
                    text: `*${service}:* ${status ? '✅ OK' : '❌ Error'}`
                }))
            }
        ];
    }

    getAlertColor(severity) {
        const colors = {
            info: '#2196F3',
            warning: '#FF9800',
            critical: '#F44336',
            success: '#4CAF50'
        };
        return colors[severity] || '#9E9E9E';
    }

    getAlertEmoji(severity) {
        const emojis = {
            info: 'ℹ️',
            warning: '⚠️',
            critical: '🚨',
            success: '✅'
        };
        return emojis[severity] || '📢';
    }

    // Integration methods (to be implemented based on your existing API)
    async getSystemStatus() {
        // This should integrate with your existing system status API
        return {
            running: true,
            uptime: '2h 30m',
            memory: '156 MB',
            activeProjects: 3
        };
    }

    async getProjects() {
        // This should integrate with your existing projects API
        return [
            { id: '1', name: 'Test Project', description: 'Sample project', status: 'active' },
            { id: '2', name: 'Demo App', description: 'Demo application', status: 'inactive' }
        ];
    }

    async startClaude(projectName) {
        // Integrate with your Claude starting logic
        this.logger.info(`Starting Claude for project: ${projectName}`);
        return { success: true };
    }

    async stopClaude(projectName) {
        // Integrate with your Claude stopping logic
        this.logger.info(`Stopping Claude for project: ${projectName}`);
        return { success: true };
    }

    async startBmad(projectName, workflow) {
        // Integrate with your BMAD starting logic
        this.logger.info(`Starting BMAD ${workflow} for project: ${projectName}`);
        return { success: true };
    }

    async getLogs(lines) {
        // Integrate with your logs API
        return Array.from({ length: lines }, (_, i) => `[${new Date().toISOString()}] Sample log line ${i + 1}`);
    }

    async getUsageStats() {
        // Integrate with your usage API
        return {
            totalRequests: 1234,
            totalTokens: 567890,
            requestsPerHour: 45,
            successRate: 98.5
        };
    }

    async performHealthCheck() {
        // Integrate with your health check logic
        return {
            overall: 'healthy',
            services: {
                'API Server': true,
                'Database': true,
                'Notification Service': true,
                'BMAD': true
            }
        };
    }

    // Configuration methods
    async updateChannelConfig(newChannels) {
        this.config.channels = { ...this.config.channels, ...newChannels };
        await this.cacheChannelIds();
        this.logger.info('Updated channel configuration:', this.config.channels);
    }

    getChannelConfig() {
        return this.config.channels;
    }

    async cleanup() {
        if (this.app) {
            await this.app.stop();
        }
        this.isInitialized = false;
        this.logger.info('Slack service cleaned up');
    }
}

module.exports = SlackService;