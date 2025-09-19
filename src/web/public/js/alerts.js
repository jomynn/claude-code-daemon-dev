/**
 * Alerts Dashboard JavaScript
 * Real-time alerts monitoring and management
 */

class AlertsManager {
    constructor() {
        this.socket = null;
        this.alerts = [];
        this.filteredAlerts = [];
        this.currentPage = 1;
        this.alertsPerPage = 20;
        this.filters = {
            severity: '',
            type: '',
            search: ''
        };

        this.init();
    }

    async init() {
        this.setupWebSocket();
        this.setupEventListeners();
        await this.loadInitialData();
        this.startPeriodicUpdates();
    }

    setupWebSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            this.socket.emit('subscribe', 'alerts');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
        });

        this.socket.on('alert', (alert) => {
            this.addNewAlert(alert);
        });
    }

    setupEventListeners() {
        // Filter controls
        document.getElementById('severity-filter').addEventListener('change', (e) => {
            this.filters.severity = e.target.value;
            this.applyFilters();
        });

        document.getElementById('type-filter').addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.applyFilters();
        });

        document.getElementById('search-alerts').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        // Action buttons
        document.getElementById('clear-alerts').addEventListener('click', () => {
            this.clearAllAlerts();
        });

        document.getElementById('test-alert').addEventListener('click', () => {
            this.sendTestAlert();
        });

        document.getElementById('refresh-alerts').addEventListener('click', () => {
            this.loadInitialData();
        });

        document.getElementById('export-alerts').addEventListener('click', () => {
            this.exportAlerts();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.displayAlerts();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredAlerts.length / this.alertsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.displayAlerts();
            }
        });

        // Threshold settings
        document.getElementById('save-thresholds').addEventListener('click', () => {
            this.saveThresholds();
        });
    }

    async loadInitialData() {
        try {
            // Load alerts
            const alertsResponse = await fetch('/api/alerts?limit=1000');
            const alertsData = await alertsResponse.json();

            if (alertsData.success) {
                this.alerts = alertsData.data;
                this.applyFilters();
                this.updateStats();
            }

            // Load notification status
            const statusResponse = await fetch('/api/alerts/status');
            const statusData = await statusResponse.json();

            if (statusData.success) {
                this.updateNotificationStatus(statusData.data);
            }

        } catch (error) {
            console.error('Error loading alerts data:', error);
        }
    }

    applyFilters() {
        this.filteredAlerts = this.alerts.filter(alert => {
            // Severity filter
            if (this.filters.severity && alert.severity !== this.filters.severity) {
                return false;
            }

            // Type filter
            if (this.filters.type && alert.type !== this.filters.type) {
                return false;
            }

            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const searchText = `${alert.type} ${alert.message} ${alert.severity}`.toLowerCase();
                if (!searchText.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.currentPage = 1;
        this.displayAlerts();
        this.updatePagination();
    }

    displayAlerts() {
        const container = document.getElementById('alerts-history');
        if (!container) {return;}

        const startIndex = (this.currentPage - 1) * this.alertsPerPage;
        const endIndex = startIndex + this.alertsPerPage;
        const pageAlerts = this.filteredAlerts.slice(startIndex, endIndex);

        container.innerHTML = '';

        if (pageAlerts.length === 0) {
            container.innerHTML = '<p style="color: #b0b0b0; text-align: center; padding: 20px;">No alerts found</p>';
            return;
        }

        pageAlerts.forEach(alert => {
            const alertElement = this.createAlertElement(alert);
            container.appendChild(alertElement);
        });
    }

    createAlertElement(alert) {
        const div = document.createElement('div');
        div.className = `alert-item ${alert.severity}`;

        div.innerHTML = `
            <div class="alert-header">
                <div class="alert-type">${alert.type}</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="alert-severity ${alert.severity}">${alert.severity}</span>
                    <span class="alert-time">${new Date(alert.timestamp).toLocaleString()}</span>
                </div>
            </div>
            <div class="alert-message">${alert.message}</div>
            ${alert.data ? `<div class="alert-data">${JSON.stringify(alert.data, null, 2)}</div>` : ''}
        `;

        return div;
    }

    addNewAlert(alert) {
        // Add to live feed
        this.addToLiveFeed(alert);

        // Add to alerts array
        this.alerts.unshift(alert);

        // Keep only recent alerts in memory (last 1000)
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(0, 1000);
        }

        // Refresh display if it matches current filters
        this.applyFilters();
        this.updateStats();
    }

    addToLiveFeed(alert) {
        const feed = document.getElementById('alert-feed');
        if (!feed) {return;}

        const alertElement = this.createAlertElement(alert);
        alertElement.style.animation = 'slideIn 0.3s ease-out';

        // Add to top of feed
        feed.insertBefore(alertElement, feed.firstChild);

        // Remove old alerts from feed (keep last 10)
        while (feed.children.length > 10) {
            feed.removeChild(feed.lastChild);
        }

        // Auto-scroll to top if user is near the top
        if (feed.scrollTop < 50) {
            feed.scrollTop = 0;
        }
    }

    updateStats() {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Recent alerts (last 24 hours)
        const recentAlerts = this.alerts.filter(a => new Date(a.timestamp) > dayAgo);

        // Critical alerts
        const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');

        // Update display
        document.getElementById('total-alerts').textContent = recentAlerts.length;
        document.getElementById('critical-count').textContent = criticalAlerts.length;
    }

    updateNotificationStatus(status) {
        // Update channel count
        document.getElementById('channel-count').textContent = status.channels.length;

        // Update channels list
        const channelsList = document.getElementById('channels-list');
        if (channelsList) {
            channelsList.innerHTML = '';

            status.channels.forEach(channel => {
                const channelElement = document.createElement('div');
                channelElement.className = 'channel-item';
                channelElement.innerHTML = `
                    <div class="channel-name">${channel}</div>
                    <div class="channel-status active">Active</div>
                `;
                channelsList.appendChild(channelElement);
            });
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredAlerts.length / this.alertsPerPage);

        document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}`;

        document.getElementById('prev-page').disabled = this.currentPage <= 1;
        document.getElementById('next-page').disabled = this.currentPage >= totalPages;
    }

    async clearAllAlerts() {
        if (!confirm('Are you sure you want to clear all alerts? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/alerts/history', {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.alerts = [];
                this.applyFilters();
                this.updateStats();

                // Clear live feed
                const feed = document.getElementById('alert-feed');
                if (feed) {
                    feed.innerHTML = '<p style="color: #b0b0b0; text-align: center;">No active alerts</p>';
                }

                this.showMessage('All alerts cleared successfully', 'success');
            } else {
                this.showMessage('Failed to clear alerts', 'error');
            }
        } catch (error) {
            console.error('Error clearing alerts:', error);
            this.showMessage('Error clearing alerts', 'error');
        }
    }

    async sendTestAlert() {
        try {
            const response = await fetch('/api/alerts/test', {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Test alert sent successfully', 'success');
            } else {
                this.showMessage('Failed to send test alert', 'error');
            }
        } catch (error) {
            console.error('Error sending test alert:', error);
            this.showMessage('Error sending test alert', 'error');
        }
    }

    async exportAlerts() {
        try {
            const params = new URLSearchParams();
            if (this.filters.severity) {params.append('severity', this.filters.severity);}
            if (this.filters.type) {params.append('type', this.filters.type);}

            const response = await fetch(`/api/alerts/filter?${params.toString()}`);
            const result = await response.json();

            if (result.success) {
                const csv = this.convertToCsv(result.data);
                this.downloadFile(csv, 'alerts-export.csv', 'text/csv');
            } else {
                this.showMessage('Failed to export alerts', 'error');
            }
        } catch (error) {
            console.error('Error exporting alerts:', error);
            this.showMessage('Error exporting alerts', 'error');
        }
    }

    convertToCsv(alerts) {
        const headers = ['Timestamp', 'Type', 'Severity', 'Message'];
        const rows = alerts.map(alert => [
            alert.timestamp,
            alert.type,
            alert.severity,
            `"${alert.message.replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    async saveThresholds() {
        const thresholds = {
            usageWarning: parseInt(document.getElementById('usage-threshold').value),
            critical: parseInt(document.getElementById('critical-threshold').value),
            prediction: parseInt(document.getElementById('prediction-threshold').value)
        };

        try {
            // This would require implementing a settings endpoint
            console.log('Saving thresholds:', thresholds);
            this.showMessage('Threshold settings saved', 'success');
        } catch (error) {
            console.error('Error saving thresholds:', error);
            this.showMessage('Error saving settings', 'error');
        }
    }

    showMessage(message, type = 'info') {
        // Create temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
        `;

        document.body.appendChild(messageEl);

        // Remove after 3 seconds
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = `status-dot ${connected ? '' : 'offline'}`;
        }
    }

    startPeriodicUpdates() {
        // Refresh alerts every 5 minutes
        setInterval(() => {
            this.loadInitialData();
        }, 5 * 60 * 1000);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize alerts manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AlertsManager();
});
