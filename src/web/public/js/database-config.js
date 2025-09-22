/**
 * Database Configuration Interface
 * Handles database connection configuration, testing, and documentation
 */

class DatabaseConfigManager {
    constructor() {
        this.currentConfig = {};
        this.logRefreshInterval = null;
        this.initializeEventListeners();
        this.loadInitialData();
    }

    initializeEventListeners() {
        // Connection status and refresh
        document.getElementById('refreshStatus')?.addEventListener('click', () => this.refreshConnectionStatus());
        document.getElementById('testConnection')?.addEventListener('click', () => this.testConnection());
        document.getElementById('loadCurrentConfig')?.addEventListener('click', () => this.loadCurrentConfig());

        // Database type toggle
        document.getElementById('dbTypeSelect')?.addEventListener('change', (e) => this.toggleDbTypeConfig(e.target.value));

        // Connection form submission
        document.getElementById('connectionForm')?.addEventListener('submit', (e) => this.saveConfiguration(e));

        // Testing buttons
        document.getElementById('testBasicConnection')?.addEventListener('click', () => this.runTest('basic'));
        document.getElementById('testQuery')?.addEventListener('click', () => this.runTest('query'));
        document.getElementById('testInsert')?.addEventListener('click', () => this.runTest('insert'));
        document.getElementById('testPerformance')?.addEventListener('click', () => this.runTest('performance'));
        document.getElementById('executeCustomQuery')?.addEventListener('click', () => this.executeCustomQuery());

        // Schema management
        document.getElementById('checkSchema')?.addEventListener('click', () => this.checkSchema());
        document.getElementById('applySchema')?.addEventListener('click', () => this.applySchema());
        document.getElementById('migrateSqlite')?.addEventListener('click', () => this.migrateSqlite());
        document.getElementById('backupDatabase')?.addEventListener('click', () => this.backupDatabase());
        document.getElementById('resetSchema')?.addEventListener('click', () => this.resetSchema());

        // Log management
        document.getElementById('refreshLogs')?.addEventListener('click', () => this.refreshLogs());
        document.getElementById('clearLogs')?.addEventListener('click', () => this.clearLogs());
        document.getElementById('autoRefreshLogs')?.addEventListener('change', (e) => this.toggleAutoRefresh(e.target.checked));

        // Documentation
        document.getElementById('generateReport')?.addEventListener('click', () => this.generateReport());
    }

    async loadInitialData() {
        try {
            await this.refreshConnectionStatus();
            await this.loadCurrentConfig();
            await this.refreshLogs();
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    async refreshConnectionStatus() {
        try {
            this.setConnectionStatus('testing', 'Checking connection...');

            const response = await fetch('/api/database/status');
            const data = await response.json();

            if (data.success) {
                this.setConnectionStatus('connected', 'Connected');
                this.updateConnectionInfo(data.data);
                this.updateMetrics(data.data.metrics || {});
            } else {
                this.setConnectionStatus('disconnected', 'Disconnected');
                this.showError('Connection check failed: ' + data.error);
            }
        } catch (error) {
            this.setConnectionStatus('disconnected', 'Connection Error');
            this.showError('Failed to check connection: ' + error.message);
        }

        this.updateLastChecked();
    }

    setConnectionStatus(status, text) {
        const indicator = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionStatusText');

        if (indicator) {
            indicator.className = `status-indicator status-${status}`;
        }
        if (statusText) {
            statusText.textContent = text;
        }
    }

    updateConnectionInfo(data) {
        const elements = {
            'dbType': data.type || 'Unknown',
            'dbHost': data.host || 'N/A',
            'dbName': data.database || 'N/A'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    updateMetrics(metrics) {
        const metricElements = {
            'activeConnections': metrics.activeConnections || 0,
            'totalConnections': metrics.totalCount || 0,
            'avgResponseTime': metrics.avgResponseTime ? `${metrics.avgResponseTime}ms` : 'N/A'
        };

        Object.entries(metricElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    updateLastChecked() {
        const element = document.getElementById('lastChecked');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }

    async loadCurrentConfig() {
        try {
            const response = await fetch('/api/database/config');
            const data = await response.json();

            if (data.success) {
                this.currentConfig = data.data;
                this.populateConfigForm(data.data);
            } else {
                this.showError('Failed to load configuration: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to load configuration: ' + error.message);
        }
    }

    populateConfigForm(config) {
        const form = document.getElementById('connectionForm');
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
            'maxConnections': config.maxConnections || 20,
            'connectionTimeout': config.connectionTimeout || 2000,
            'idleTimeout': config.idleTimeout || 30000
        };

        Object.entries(fieldMappings).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value !== undefined) {
                element.value = value;
            }
        });
    }

    toggleDbTypeConfig(dbType) {
        const postgresConfig = document.getElementById('postgresConfig');
        const sqliteConfig = document.getElementById('sqliteConfig');

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

    async saveConfiguration(event) {
        event.preventDefault();

        try {
            const formData = new FormData(event.target);
            const config = Object.fromEntries(formData.entries());

            // Add pool settings
            config.maxConnections = parseInt(document.getElementById('maxConnections')?.value || 20);
            config.connectionTimeout = parseInt(document.getElementById('connectionTimeout')?.value || 2000);
            config.idleTimeout = parseInt(document.getElementById('idleTimeout')?.value || 30000);

            const response = await fetch('/api/database/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Configuration saved successfully');
                await this.refreshConnectionStatus();
            } else {
                this.showError('Failed to save configuration: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to save configuration: ' + error.message);
        }
    }

    async testConnection() {
        await this.runTest('connection');
    }

    async runTest(testType) {
        const testResults = document.getElementById('testResults');
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
        const queryTextarea = document.getElementById('customQuery');
        const testResults = document.getElementById('testResults');

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

    async checkSchema() {
        try {
            const response = await fetch('/api/database/schema/check');
            const data = await response.json();

            const schemaStatus = document.getElementById('schemaStatus');
            const tableInfo = document.getElementById('tableInfo');

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
            document.getElementById('schemaStatus').innerHTML = `
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

    async refreshLogs() {
        try {
            const response = await fetch('/api/database/logs');
            const data = await response.json();

            const logsContainer = document.getElementById('connectionLogs');
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
        const logsContainer = document.getElementById('connectionLogs');
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
                a.download = `database-connection-report-${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                this.showSuccess('Connection report generated');
            } else {
                const data = await response.json();
                this.showError('Report generation failed: ' + data.error);
            }
        } catch (error) {
            this.showError('Report generation failed: ' + error.message);
        }
    }

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
    new DatabaseConfigManager();
});