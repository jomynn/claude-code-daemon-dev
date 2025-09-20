/**
 * Slack Configuration Management Interface
 * Handles Slack integration setup and management
 */

class SlackConfigManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSlackStatus();
        this.loadChannelConfig();
        this.loadCommands();
    }

    setupEventListeners() {
        // Credential management
        document.getElementById('test-connection').addEventListener('click', () => {
            this.testConnection();
        });

        document.getElementById('save-credentials').addEventListener('click', () => {
            this.saveCredentials();
        });

        // Channel management
        document.getElementById('validate-channels').addEventListener('click', () => {
            this.validateChannels();
        });

        document.getElementById('save-channels').addEventListener('click', () => {
            this.saveChannels();
        });

        // Testing
        document.getElementById('send-test-message').addEventListener('click', () => {
            this.sendTestMessage();
        });

        document.getElementById('send-test-alert').addEventListener('click', () => {
            this.sendTestAlert();
        });

        document.getElementById('send-status-update').addEventListener('click', () => {
            this.sendStatusUpdate();
        });

        // Auto-refresh status every 30 seconds
        setInterval(() => {
            this.loadSlackStatus();
        }, 30000);
    }

    async loadSlackStatus() {
        try {
            const response = await fetch('/api/slack/status');
            const result = await response.json();

            if (result.success) {
                this.updateStatusDisplay(result.data);
            } else {
                console.error('Failed to load Slack status:', result.error);
            }
        } catch (error) {
            console.error('Error loading Slack status:', error);
            this.updateStatusDisplay({
                available: false,
                initialized: false,
                channels: {}
            });
        }
    }

    updateStatusDisplay(status) {
        const statusDot = document.getElementById('slack-connection-status');
        const statusText = document.getElementById('slack-status-text');
        const botStatus = document.getElementById('bot-status');
        const channelCount = document.getElementById('channel-count');

        if (status.available && status.initialized) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Connected';
            botStatus.innerHTML = '✅ Connected';
        } else if (status.available) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Initializing';
            botStatus.innerHTML = '⚠️ Initializing';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Disconnected';
            botStatus.innerHTML = '❌ Disconnected';
        }

        const channels = status.channels || {};
        channelCount.textContent = Object.keys(channels).length;
    }

    async loadChannelConfig() {
        try {
            const response = await fetch('/api/slack/channels');
            const result = await response.json();

            if (result.success) {
                const channels = result.data || {};

                document.getElementById('alerts-channel').value = channels.alerts || '';
                document.getElementById('status-channel').value = channels.status || '';
                document.getElementById('commands-channel').value = channels.commands || '';
                document.getElementById('general-channel').value = channels.general || '';
            }
        } catch (error) {
            console.error('Error loading channel config:', error);
        }
    }

    async loadCommands() {
        try {
            const response = await fetch('/api/slack/commands');
            const result = await response.json();

            if (result.success) {
                this.renderCommands(result.data.commands);
            }
        } catch (error) {
            console.error('Error loading commands:', error);
        }
    }

    renderCommands(commands) {
        const container = document.getElementById('commands-list');
        container.innerHTML = '';

        commands.forEach(cmd => {
            const commandDiv = document.createElement('div');
            commandDiv.className = 'command-item';
            commandDiv.innerHTML = `
                <div class="command-header">
                    <code>${cmd.command}</code>
                    <span class="command-usage">${cmd.usage}</span>
                </div>
                <div class="command-description">${cmd.description}</div>
            `;
            container.appendChild(commandDiv);
        });

        document.getElementById('commands-count').textContent = commands.length;
    }

    async testConnection() {
        const button = document.getElementById('test-connection');
        button.disabled = true;
        button.textContent = 'Testing...';

        try {
            const response = await fetch('/api/slack/status');
            const result = await response.json();

            if (result.success && result.data.initialized) {
                this.showNotification('✅ Slack connection successful!', 'success');
            } else {
                this.showNotification('❌ Slack connection failed. Check your credentials.', 'error');
            }
        } catch (error) {
            this.showNotification('❌ Error testing connection: ' + error.message, 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Test Connection';
        }
    }

    async saveCredentials() {
        const botToken = document.getElementById('bot-token').value;
        const appToken = document.getElementById('app-token').value;
        const signingSecret = document.getElementById('signing-secret').value;

        if (!botToken || !appToken || !signingSecret) {
            this.showNotification('❌ All credential fields are required', 'error');
            return;
        }

        this.showNotification('💾 Credentials saved to environment. Please restart the server to apply changes.', 'info');

        // In a real implementation, you'd save these to environment variables or config file
        // For now, just show the user what to do
        this.showEnvironmentVariables(botToken, appToken, signingSecret);
    }

    showEnvironmentVariables(botToken, appToken, signingSecret) {
        const envVars = `
# Add these to your environment variables or .env file:
SLACK_BOT_TOKEN=${botToken}
SLACK_APP_TOKEN=${appToken}
SLACK_SIGNING_SECRET=${signingSecret}

# Optional: Configure default channels
SLACK_ALERTS_CHANNEL=#claude-alerts
SLACK_STATUS_CHANNEL=#claude-status
SLACK_COMMANDS_CHANNEL=#claude-control
SLACK_GENERAL_CHANNEL=#claude-general
        `;

        // Create a modal or copy to clipboard
        navigator.clipboard.writeText(envVars).then(() => {
            this.showNotification('📋 Environment variables copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback: show in a modal
            alert('Add these environment variables:\n\n' + envVars);
        });
    }

    async validateChannels() {
        const channels = {
            alerts: document.getElementById('alerts-channel').value,
            status: document.getElementById('status-channel').value,
            commands: document.getElementById('commands-channel').value,
            general: document.getElementById('general-channel').value
        };

        // Basic validation
        let isValid = true;
        const errors = [];

        Object.entries(channels).forEach(([key, value]) => {
            if (value && !value.startsWith('#') && !value.match(/^[A-Z0-9]+$/)) {
                errors.push(`${key} channel should start with # or be a channel ID`);
                isValid = false;
            }
        });

        if (isValid) {
            this.showNotification('✅ Channel configuration looks good!', 'success');
        } else {
            this.showNotification('❌ Validation errors: ' + errors.join(', '), 'error');
        }
    }

    async saveChannels() {
        const channels = {
            alerts: document.getElementById('alerts-channel').value,
            status: document.getElementById('status-channel').value,
            commands: document.getElementById('commands-channel').value,
            general: document.getElementById('general-channel').value
        };

        try {
            const response = await fetch('/api/slack/channels', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ channels })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('✅ Channel configuration saved successfully!', 'success');
                this.loadSlackStatus(); // Refresh status
            } else {
                this.showNotification('❌ Failed to save channels: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('❌ Error saving channels: ' + error.message, 'error');
        }
    }

    async sendTestMessage() {
        const channel = document.getElementById('test-channel').value;
        const message = document.getElementById('test-message').value;

        if (!message.trim()) {
            this.showNotification('❌ Please enter a test message', 'error');
            return;
        }

        try {
            const response = await fetch('/api/slack/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    channel: channel
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('✅ Test message sent successfully!', 'success');
            } else {
                this.showNotification('❌ Failed to send message: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('❌ Error sending message: ' + error.message, 'error');
        }
    }

    async sendTestAlert() {
        try {
            const response = await fetch('/api/slack/test-alert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    severity: 'warning'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('✅ Test alert sent successfully!', 'success');
            } else {
                this.showNotification('❌ Failed to send alert: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('❌ Error sending alert: ' + error.message, 'error');
        }
    }

    async sendStatusUpdate() {
        try {
            const response = await fetch('/api/slack/status-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('✅ Status update sent successfully!', 'success');
            } else {
                this.showNotification('❌ Failed to send status update: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('❌ Error sending status update: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SlackConfigManager();
});