/**
 * Unified Settings Manager
 * Handles all configuration sections: Database, Slack, Notifications, System
 */

class SettingsManager {
    constructor() {
        this.currentConfig = {};
        this.slackStatus = {};
        this.databaseStatus = {};
        this.logRefreshInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.setupAutoRefresh();
    }

    setupEventListeners() {
        // Overview refresh
        document.getElementById('refreshOverview')?.addEventListener('click', () => this.refreshOverview());

        // Database configuration
        this.setupDatabaseEventListeners();

        // Slack configuration
        this.setupSlackEventListeners();

        // System settings
        this.setupSystemEventListeners();

        // Tab switching
        this.setupTabEventListeners();
    }

    setupDatabaseEventListeners() {
        // Connection status and refresh
        document.getElementById('refreshDatabaseStatus')?.addEventListener('click', () => this.refreshDatabaseStatus());
        document.getElementById('testDatabaseConnection')?.addEventListener('click', () => this.testDatabaseConnection());
        document.getElementById('loadDatabaseConfig')?.addEventListener('click', () => this.loadDatabaseConfig());

        // Database type toggle
        document.getElementById('dbTypeSelect')?.addEventListener('change', (e) => this.toggleDbTypeConfig(e.target.value));

        // Database form submission
        document.getElementById('databaseForm')?.addEventListener('submit', (e) => this.saveDatabaseConfiguration(e));

        // Database testing buttons
        document.getElementById('testBasicConnection')?.addEventListener('click', () => this.runDatabaseTest('basic'));
        document.getElementById('testQuery')?.addEventListener('click', () => this.runDatabaseTest('query'));
        document.getElementById('testInsert')?.addEventListener('click', () => this.runDatabaseTest('insert'));
        document.getElementById('testPerformance')?.addEventListener('click', () => this.runDatabaseTest('performance'));
        document.getElementById('executeCustomQuery')?.addEventListener('click', () => this.executeCustomQuery());

        // Schema management
        document.getElementById('checkSchema')?.addEventListener('click', () => this.checkSchema());
        document.getElementById('applySchema')?.addEventListener('click', () => this.applySchema());
        document.getElementById('migrateSqlite')?.addEventListener('click', () => this.migrateSqlite());
        document.getElementById('backupDatabase')?.addEventListener('click', () => this.backupDatabase());
        document.getElementById('resetSchema')?.addEventListener('click', () => this.resetSchema());
    }

    setupSlackEventListeners() {
        // Slack credential management
        document.getElementById('testSlackConnection')?.addEventListener('click', () => this.testSlackConnection());
        document.getElementById('saveSlackCredentials')?.addEventListener('click', () => this.saveSlackCredentials());

        // Slack channel management
        document.getElementById('validateSlackChannels')?.addEventListener('click', () => this.validateSlackChannels());
        document.getElementById('saveSlackChannels')?.addEventListener('click', () => this.saveSlackChannels());

        // Slack testing
        document.getElementById('sendTestMessage')?.addEventListener('click', () => this.sendTestMessage());
        document.getElementById('sendTestAlert')?.addEventListener('click', () => this.sendTestAlert());
        document.getElementById('sendStatusUpdate')?.addEventListener('click', () => this.sendStatusUpdate());
    }

    setupSystemEventListeners() {
        // Log management
        document.getElementById('refreshLogs')?.addEventListener('click', () => this.refreshLogs());
        document.getElementById('clearLogs')?.addEventListener('click', () => this.clearLogs());
        document.getElementById('autoRefreshLogs')?.addEventListener('change', (e) => this.toggleAutoRefresh(e.target.checked));

        // Report generation
        document.getElementById('generateReport')?.addEventListener('click', () => this.generateReport());
    }

    setupTabEventListeners() {
        // Handle tab switching
        const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
        tabButtons.forEach(button => {
            button.addEventListener('shown.bs.tab', (e) => {
                const targetTab = e.target.getAttribute('data-bs-target');
                this.onTabSwitch(targetTab);
            });
        });
    }

    onTabSwitch(tabId) {
        switch (tabId) {
            case '#database':
                this.refreshDatabaseStatus();
                break;
            case '#slack':
                this.loadSlackStatus();
                break;
            case '#system':
                this.refreshLogs();
                break;
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.refreshOverview(),
                this.refreshDatabaseStatus(),
                this.loadSlackStatus(),
                this.loadDatabaseConfig(),
                this.loadSlackChannelConfig()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    setupAutoRefresh() {
        // Auto-refresh overview every 30 seconds
        setInterval(() => {
            this.refreshOverview();
        }, 30000);

        // Auto-refresh Slack status every 30 seconds
        setInterval(() => {
            this.loadSlackStatus();
        }, 30000);
    }

    async refreshOverview() {
        try {
            const [databaseResponse, slackResponse] = await Promise.all([
                fetch('/api/database/status'),
                fetch('/api/slack/status')
            ]);

            const databaseData = await databaseResponse.json();
            const slackData = await slackResponse.json();

            this.updateOverviewStatus(databaseData, slackData);
        } catch (error) {
            console.error('Failed to refresh overview:', error);
        }
    }

    updateOverviewStatus(databaseData, slackData) {
        // Update database overview
        const dbStatus = document.getElementById('overviewDbStatus');
        const dbInfo = document.getElementById('overviewDbInfo');

        if (databaseData.success) {
            dbStatus.innerHTML = '<span class="badge bg-success">Connected</span>';
            dbInfo.textContent = `${databaseData.data.type} - ${databaseData.data.database}`;
        } else {
            dbStatus.innerHTML = '<span class="badge bg-danger">Disconnected</span>';
            dbInfo.textContent = 'Connection failed';
        }

        // Update Slack overview
        const slackStatus = document.getElementById('overviewSlackStatus');
        const slackInfo = document.getElementById('overviewSlackInfo');

        if (slackData.success && slackData.data.available && slackData.data.initialized) {
            slackStatus.innerHTML = '<span class="badge bg-success">Connected</span>';
            const channelCount = Object.keys(slackData.data.channels || {}).length;
            slackInfo.textContent = `${channelCount} channels configured`;
        } else {
            slackStatus.innerHTML = '<span class="badge bg-danger">Disconnected</span>';
            slackInfo.textContent = 'Not configured';
        }

        // Update system metrics
        this.updateSystemMetrics(databaseData.data?.metrics);
    }

    updateSystemMetrics(metrics) {
        if (!metrics) return;

        const elements = {
            'overviewActiveConnections': metrics.activeConnections || 0,
            'overviewResponseTime': metrics.avgResponseTime ? `${metrics.avgResponseTime}ms` : 'N/A',
            'overviewUptime': this.formatUptime(process?.uptime || 0)
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    // Database Configuration Methods
    async refreshDatabaseStatus() {
        try {
            this.setDatabaseStatus('testing', 'Checking connection...');

            const response = await fetch('/api/database/status');
            const data = await response.json();

            if (data.success) {
                this.setDatabaseStatus('connected', 'Connected');
                this.updateDatabaseInfo(data.data);
                this.updateDatabaseMetrics(data.data.metrics || {});
            } else {
                this.setDatabaseStatus('disconnected', 'Disconnected');
                this.showError('Database connection check failed: ' + data.error);
            }
        } catch (error) {
            this.setDatabaseStatus('disconnected', 'Connection Error');
            this.showError('Failed to check database connection: ' + error.message);
        }

        this.updateLastChecked();
    }

    setDatabaseStatus(status, text) {
        const indicator = document.getElementById('databaseConnectionStatus');
        const statusText = document.getElementById('databaseStatusText');

        if (indicator) {
            indicator.className = `status-indicator status-${status}`;
        }
        if (statusText) {
            statusText.textContent = text;
        }
    }

    updateDatabaseInfo(data) {
        const elements = {
            'dbTypeDisplay': data.type || 'Unknown',
            'dbHostDisplay': data.host || 'N/A',
            'dbNameDisplay': data.database || 'N/A'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    updateDatabaseMetrics(metrics) {
        const metricElements = {
            'activeConnectionsDisplay': metrics.activeConnections || 0,
            'totalConnectionsDisplay': metrics.totalCount || 0,
            'avgResponseTimeDisplay': metrics.avgResponseTime ? `${metrics.avgResponseTime}ms` : 'N/A'
        };

        Object.entries(metricElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    updateLastChecked() {
        const element = document.getElementById('lastCheckedDisplay');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }

    async loadDatabaseConfig() {
        try {
            const response = await fetch('/api/database/config');
            const data = await response.json();

            if (data.success) {
                this.currentConfig = data.data;
                this.populateDatabaseForm(data.data);
            } else {
                this.showError('Failed to load database configuration: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to load database configuration: ' + error.message);
        }
    }

    populateDatabaseForm(config) {
        const form = document.getElementById('databaseForm');
        if (!form) return;

        // Set database type
        const dbTypeSelect = document.getElementById('dbTypeSelect');
        if (dbTypeSelect && config.type) {
            dbTypeSelect.value = config.type;
            this.toggleDbTypeConfig(config.type);
        }

        // Populate form fields
        const fieldMappings = {
            'dbHostInput': config.host,
            'dbPortInput': config.port,
            'dbNameInput': config.database,
            'dbUserInput': config.user,
            'dbPathInput': config.path,
            'maxConnectionsInput': config.maxConnections || 20,
            'connectionTimeoutInput': config.connectionTimeout || 2000,
            'idleTimeoutInput': config.idleTimeout || 30000
        };

        Object.entries(fieldMappings).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value !== undefined) {
                element.value = value;
            }
        });
    }

    toggleDbTypeConfig(dbType) {
        const postgresConfig = document.getElementById('postgresConfigSection');
        const sqliteConfig = document.getElementById('sqliteConfigSection');

        if (postgresConfig && sqliteConfig) {
            if (dbType === 'postgresql') {
                postgresConfig.style.display = 'block';
                sqliteConfig.style.display = 'none';
            } else {
                postgresConfig.style.display = 'none';
                sqliteConfig.style.display = 'block';
            }
        }
    }

    async saveDatabaseConfiguration(event) {
        event.preventDefault();

        try {
            const formData = new FormData(event.target);
            const config = Object.fromEntries(formData.entries());

            // Add pool settings
            config.maxConnections = parseInt(document.getElementById('maxConnectionsInput')?.value || 20);
            config.connectionTimeout = parseInt(document.getElementById('connectionTimeoutInput')?.value || 2000);
            config.idleTimeout = parseInt(document.getElementById('idleTimeoutInput')?.value || 30000);

            const response = await fetch('/api/database/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Database configuration saved successfully');
                await this.refreshDatabaseStatus();
            } else {
                this.showError('Failed to save database configuration: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to save database configuration: ' + error.message);
        }
    }

    async testDatabaseConnection() {
        await this.runDatabaseTest('connection');
    }

    async runDatabaseTest(testType) {
        const testResults = document.getElementById('databaseTestResults');
        if (!testResults) return;

        try {
            testResults.innerHTML = '<div class="text-info"><i class="bi bi-hourglass-split"></i> Running test...</div>';

            const response = await fetch(`/api/database/test/${testType}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                testResults.innerHTML = `
                    <div class="text-success mb-2">
                        <i class="bi bi-check-circle"></i> Test completed successfully
                    </div>
                    <pre class="test-result">${JSON.stringify(data.data, null, 2)}</pre>
                `;
            } else {
                testResults.innerHTML = `
                    <div class="text-danger mb-2">
                        <i class="bi bi-x-circle"></i> Test failed
                    </div>
                    <pre class="test-result text-danger">${data.error}</pre>
                `;
            }
        } catch (error) {
            testResults.innerHTML = `
                <div class="text-danger mb-2">
                    <i class="bi bi-x-circle"></i> Test error
                </div>
                <pre class="test-result text-danger">${error.message}</pre>
            `;
        }
    }

    async executeCustomQuery() {
        const queryTextarea = document.getElementById('customQueryInput');
        const testResults = document.getElementById('databaseTestResults');

        if (!queryTextarea || !testResults) return;

        const query = queryTextarea.value.trim();
        if (!query) {
            this.showError('Please enter a SQL query');
            return;
        }

        try {
            testResults.innerHTML = '<div class="text-info"><i class="bi bi-hourglass-split"></i> Executing query...</div>';

            const response = await fetch('/api/database/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();

            if (data.success) {
                testResults.innerHTML = `
                    <div class="text-success mb-2">
                        <i class="bi bi-check-circle"></i> Query executed successfully
                    </div>
                    <pre class="test-result">${JSON.stringify(data.data, null, 2)}</pre>
                `;
            } else {
                testResults.innerHTML = `
                    <div class="text-danger mb-2">
                        <i class="bi bi-x-circle"></i> Query failed
                    </div>
                    <pre class="test-result text-danger">${data.error}</pre>
                `;
            }
        } catch (error) {
            testResults.innerHTML = `
                <div class="text-danger mb-2">
                    <i class="bi bi-x-circle"></i> Query error
                </div>
                <pre class="test-result text-danger">${error.message}</pre>
            `;
        }
    }

    // Schema Management Methods
    async checkSchema() {
        try {
            const response = await fetch('/api/database/schema/check');
            const data = await response.json();

            const schemaStatus = document.getElementById('schemaStatusDisplay');
            const tableInfo = document.getElementById('tableInfoDisplay');

            if (data.success) {
                schemaStatus.innerHTML = `
                    <div class="alert alert-success">
                        <i class="bi bi-check-circle"></i> Schema is valid
                        <br><small>Found ${data.data.tables.length} tables</small>
                    </div>
                `;

                tableInfo.innerHTML = this.formatTableInfo(data.data.tables);
            } else {
                schemaStatus.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-x-circle"></i> Schema issues detected
                        <br><small>${data.error}</small>
                    </div>
                `;
            }
        } catch (error) {
            document.getElementById('schemaStatusDisplay').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Failed to check schema: ${error.message}
                </div>
            `;
        }
    }

    formatTableInfo(tables) {
        if (!tables || tables.length === 0) {
            return '<em>No tables found</em>';
        }

        return tables.map(table => `
            <div class="mb-3">
                <strong>${table.name}</strong>
                <br><small class="text-muted">${table.rows || 0} rows</small>
            </div>
        `).join('');
    }

    async applySchema() {
        if (!confirm('This will apply the database schema. Continue?')) return;

        try {
            const response = await fetch('/api/database/schema/apply', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Schema applied successfully');
                await this.checkSchema();
            } else {
                this.showError('Failed to apply schema: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to apply schema: ' + error.message);
        }
    }

    async migrateSqlite() {
        if (!confirm('This will migrate data from SQLite to PostgreSQL. Continue?')) return;

        try {
            const response = await fetch('/api/database/migrate', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Migration completed successfully');
                await this.checkSchema();
            } else {
                this.showError('Migration failed: ' + data.error);
            }
        } catch (error) {
            this.showError('Migration failed: ' + error.message);
        }
    }

    async backupDatabase() {
        try {
            const response = await fetch('/api/database/backup', {
                method: 'POST'
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `database-backup-${new Date().toISOString().split('T')[0]}.sql`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                this.showSuccess('Database backup downloaded');
            } else {
                const data = await response.json();
                this.showError('Backup failed: ' + data.error);
            }
        } catch (error) {
            this.showError('Backup failed: ' + error.message);
        }
    }

    async resetSchema() {
        if (!confirm('This will reset the entire database schema and delete all data. This action cannot be undone. Continue?')) return;

        try {
            const response = await fetch('/api/database/schema/reset', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Schema reset successfully');
                await this.checkSchema();
            } else {
                this.showError('Reset failed: ' + data.error);
            }
        } catch (error) {
            this.showError('Reset failed: ' + error.message);
        }
    }

    // Slack Configuration Methods
    async loadSlackStatus() {
        try {
            const response = await fetch('/api/slack/status');
            const result = await response.json();

            if (result.success) {
                this.updateSlackStatusDisplay(result.data);
            } else {
                console.error('Failed to load Slack status:', result.error);
            }
        } catch (error) {
            console.error('Error loading Slack status:', error);
            this.updateSlackStatusDisplay({
                available: false,
                initialized: false,
                channels: {}
            });
        }
    }

    updateSlackStatusDisplay(status) {
        const statusDot = document.getElementById('slackConnectionStatus');
        const statusText = document.getElementById('slackStatusText');
        const botStatus = document.getElementById('slackBotStatus');
        const channelCount = document.getElementById('slackChannelCount');

        if (status.available && status.initialized) {
            statusDot.className = 'status-indicator status-connected';
            statusText.textContent = 'Connected';
            botStatus.innerHTML = '✅ Connected';
        } else if (status.available) {
            statusDot.className = 'status-indicator status-testing';
            statusText.textContent = 'Initializing';
            botStatus.innerHTML = '⚠️ Initializing';
        } else {
            statusDot.className = 'status-indicator status-disconnected';
            statusText.textContent = 'Disconnected';
            botStatus.innerHTML = '❌ Disconnected';
        }

        const channels = status.channels || {};
        channelCount.textContent = Object.keys(channels).length;
    }

    async loadSlackChannelConfig() {
        try {
            const response = await fetch('/api/slack/channels');
            const result = await response.json();

            if (result.success) {
                const channels = result.data || {};

                document.getElementById('alertsChannelInput').value = channels.alerts || '';
                document.getElementById('statusChannelInput').value = channels.status || '';
                document.getElementById('commandsChannelInput').value = channels.commands || '';
                document.getElementById('generalChannelInput').value = channels.general || '';
            }
        } catch (error) {
            console.error('Error loading Slack channel config:', error);
        }
    }

    async testSlackConnection() {
        const button = document.getElementById('testSlackConnection');
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

    async saveSlackCredentials() {
        const botToken = document.getElementById('slackBotTokenInput').value;
        const appToken = document.getElementById('slackAppTokenInput').value;
        const signingSecret = document.getElementById('slackSigningSecretInput').value;

        if (!botToken || !appToken || !signingSecret) {
            this.showNotification('❌ All credential fields are required', 'error');
            return;
        }

        this.showNotification('💾 Credentials saved to environment. Please restart the server to apply changes.', 'info');

        // Show environment variables
        this.showSlackEnvironmentVariables(botToken, appToken, signingSecret);
    }

    showSlackEnvironmentVariables(botToken, appToken, signingSecret) {
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

    async validateSlackChannels() {
        const channels = {
            alerts: document.getElementById('alertsChannelInput').value,
            status: document.getElementById('statusChannelInput').value,
            commands: document.getElementById('commandsChannelInput').value,
            general: document.getElementById('generalChannelInput').value
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

    async saveSlackChannels() {
        const channels = {
            alerts: document.getElementById('alertsChannelInput').value,
            status: document.getElementById('statusChannelInput').value,
            commands: document.getElementById('commandsChannelInput').value,
            general: document.getElementById('generalChannelInput').value
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
        const channel = document.getElementById('testChannelInput').value;
        const message = document.getElementById('testMessageInput').value;

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

    // System Methods
    async refreshLogs() {
        try {
            const response = await fetch('/api/database/logs');
            const data = await response.json();

            const logsContainer = document.getElementById('systemLogs');
            if (logsContainer && data.success) {
                logsContainer.innerHTML = this.formatLogs(data.data);
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }
        } catch (error) {
            console.error('Failed to refresh logs:', error);
        }
    }

    formatLogs(logs) {
        if (!logs || logs.length === 0) {
            return '<em>No logs available</em>';
        }

        return logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const levelClass = `log-level-${log.level}`;

            return `<div class="${levelClass}">[${timestamp}] ${log.level.toUpperCase()}: ${log.message}</div>`;
        }).join('');
    }

    clearLogs() {
        const logsContainer = document.getElementById('systemLogs');
        if (logsContainer) {
            logsContainer.innerHTML = '<em>Logs cleared</em>';
        }
    }

    toggleAutoRefresh(enabled) {
        if (enabled) {
            this.logRefreshInterval = setInterval(() => this.refreshLogs(), 5000);
        } else {
            if (this.logRefreshInterval) {
                clearInterval(this.logRefreshInterval);
                this.logRefreshInterval = null;
            }
        }
    }

    async generateReport() {
        try {
            const response = await fetch('/api/database/report');

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `settings-report-${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                this.showSuccess('Settings report generated');
            } else {
                const data = await response.json();
                this.showError('Report generation failed: ' + data.error);
            }
        } catch (error) {
            this.showError('Report generation failed: ' + error.message);
        }
    }

    // Utility Methods
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'danger');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});