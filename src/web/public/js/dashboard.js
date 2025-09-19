/**
 * Dashboard JavaScript
 * Real-time dashboard functionality with WebSocket and Chart.js
 */

class Dashboard {
    constructor() {
        this.socket = null;
        this.usageChart = null;
        this.requestChart = null;
        this.usageData = [];
        this.requestData = [];
        this.lastUpdate = null;

        this.init();
    }

    async init() {
        this.setupWebSocket();
        this.setupCharts();
        this.loadInitialData();
        this.startPeriodicUpdates();
    }

    setupWebSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to daemon');
            this.updateConnectionStatus(true);
            this.socket.emit('subscribe', 'usage');
            this.socket.emit('subscribe', 'system');
            this.socket.emit('subscribe', 'alerts');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from daemon');
            this.updateConnectionStatus(false);
        });

        this.socket.on('usage-update', (data) => {
            this.updateUsageDisplay(data);
        });

        this.socket.on('system-status', (data) => {
            this.updateSystemStatus(data);
        });

        this.socket.on('alert', (alert) => {
            this.addAlert(alert);
        });
    }

    setupCharts() {
        // Usage Chart
        const usageCtx = document.getElementById('usage-chart').getContext('2d');
        this.usageChart = new Chart(usageCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Tokens',
                    data: [],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: '#404040'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: '#404040'
                        }
                    }
                }
            }
        });

        // Request Chart
        const requestCtx = document.getElementById('request-chart').getContext('2d');
        this.requestChart = new Chart(requestCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Requests/Hour',
                    data: [],
                    backgroundColor: 'rgba(255, 152, 0, 0.7)',
                    borderColor: '#FF9800',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: '#404040'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: '#404040'
                        }
                    }
                }
            }
        });
    }

    async loadInitialData() {
        try {
            // Load current usage
            const usageResponse = await fetch('/api/usage/current');
            const usageData = await usageResponse.json();
            if (usageData.success) {
                this.updateUsageDisplay(usageData.data);
            }

            // Load usage history
            const historyResponse = await fetch('/api/usage/history?hours=24');
            const historyData = await historyResponse.json();
            if (historyData.success) {
                this.updateCharts(historyData.data);
            }

            // Load alerts
            const alertsResponse = await fetch('/api/alerts?limit=10');
            const alertsData = await alertsResponse.json();
            if (alertsData.success) {
                this.displayAlerts(alertsData.data);
            }

            // Load system status
            const systemResponse = await fetch('/api/system/status');
            const systemData = await systemResponse.json();
            if (systemData.success) {
                this.updateSystemStatus(systemData.data);
            }

        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    updateUsageDisplay(data) {
        // Update current tokens
        const tokensEl = document.getElementById('current-tokens');
        if (tokensEl) {
            tokensEl.textContent = this.formatNumber(data.tokens || 0);
        }

        // Update requests per hour
        const requestsEl = document.getElementById('requests-hour');
        if (requestsEl) {
            requestsEl.textContent = data.requestsPerHour || 0;
        }

        // Update usage progress (assuming 1M token limit)
        const limit = 1000000;
        const percentage = ((data.tokens || 0) / limit) * 100;

        const progressEl = document.getElementById('usage-progress');
        const percentEl = document.getElementById('usage-percent');

        if (progressEl) {
            progressEl.style.width = `${Math.min(percentage, 100)}%`;

            // Change color based on usage
            if (percentage > 90) {
                progressEl.style.background = '#F44336';
            } else if (percentage > 70) {
                progressEl.style.background = '#FF9800';
            } else {
                progressEl.style.background = 'linear-gradient(90deg, #2196F3, #FF9800)';
            }
        }

        if (percentEl) {
            percentEl.textContent = percentage.toFixed(1);
        }

        // Calculate changes
        if (this.lastUpdate) {
            const tokenChange = data.tokens - this.lastUpdate.tokens;
            const requestChange = data.requestsPerHour - this.lastUpdate.requestsPerHour;

            this.updateChange('tokens-change', tokenChange);
            this.updateChange('requests-change', requestChange);
        }

        this.lastUpdate = data;
    }

    updateChange(elementId, change) {
        const el = document.getElementById(elementId);
        if (!el) {return;}

        const percentage = change > 0 ? `+${change}` : change.toString();
        el.textContent = `${percentage}`;

        el.className = 'stat-change';
        if (change > 0) {
            el.classList.add('positive');
        } else if (change < 0) {
            el.classList.add('negative');
        }
    }

    updateCharts(data) {
        if (!data || data.length === 0) {return;}

        // Sort data by timestamp
        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Take last 24 hours
        const hours = 24;
        const recentData = data.slice(-hours);

        // Update labels and data
        const labels = recentData.map(d => {
            const date = new Date(d.timestamp);
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        });

        const tokens = recentData.map(d => d.tokens || 0);
        const requests = recentData.map(d => d.requests_per_hour || 0);

        // Update usage chart
        this.usageChart.data.labels = labels;
        this.usageChart.data.datasets[0].data = tokens;
        this.usageChart.update();

        // Update request chart
        this.requestChart.data.labels = labels;
        this.requestChart.data.datasets[0].data = requests;
        this.requestChart.update();
    }

    updateSystemStatus(data) {
        // Update uptime
        const uptimeEl = document.getElementById('uptime');
        if (uptimeEl && data.uptime) {
            const hours = Math.floor(data.uptime / 3600);
            const minutes = Math.floor((data.uptime % 3600) / 60);
            uptimeEl.textContent = `${hours}h ${minutes}m`;
        }

        // Update memory usage
        const memoryEl = document.getElementById('memory-usage');
        if (memoryEl && data.memory) {
            const mb = Math.round(data.memory.heapUsed / 1024 / 1024);
            memoryEl.textContent = `${mb} MB`;
        }

        // Update daemon status
        const statusEl = document.getElementById('daemon-status');
        if (statusEl) {
            statusEl.textContent = data.healthy ? 'Running' : 'Error';
            statusEl.className = `info-value ${data.healthy ? 'success' : 'error'}`;
        }
    }

    displayAlerts(alerts) {
        const alertsList = document.getElementById('alerts-list');
        if (!alertsList) {return;}

        alertsList.innerHTML = '';

        if (alerts.length === 0) {
            alertsList.innerHTML = '<p style="color: #b0b0b0;">No recent alerts</p>';
            return;
        }

        alerts.slice(0, 10).forEach(alert => {
            this.addAlert(alert);
        });
    }

    addAlert(alert) {
        const alertsList = document.getElementById('alerts-list');
        if (!alertsList) {return;}

        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ${alert.severity}`;

        alertEl.innerHTML = `
            <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
            <div class="alert-message">${alert.message}</div>
        `;

        // Insert at the beginning
        alertsList.insertBefore(alertEl, alertsList.firstChild);

        // Remove old alerts (keep max 10)
        while (alertsList.children.length > 10) {
            alertsList.removeChild(alertsList.lastChild);
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = `status-dot ${connected ? '' : 'offline'}`;
        }
    }

    startPeriodicUpdates() {
        // Update usage predictions every 5 minutes
        setInterval(async () => {
            try {
                const response = await fetch('/api/usage/predictions');
                const data = await response.json();

                if (data.success && data.data) {
                    this.updatePredictions(data.data);
                }
            } catch (error) {
                console.error('Error updating predictions:', error);
            }
        }, 5 * 60 * 1000);

        // Update charts every minute
        setInterval(async () => {
            try {
                const response = await fetch('/api/usage/history?hours=24');
                const data = await response.json();

                if (data.success) {
                    this.updateCharts(data.data);
                }
            } catch (error) {
                console.error('Error updating charts:', error);
            }
        }, 60 * 1000);
    }

    updatePredictions(predictions) {
        const timeRemainingEl = document.getElementById('time-remaining');
        const predictionEl = document.getElementById('limit-prediction');

        if (timeRemainingEl && predictions.hoursRemaining) {
            if (predictions.hoursRemaining === Infinity) {
                timeRemainingEl.textContent = '∞';
            } else {
                timeRemainingEl.textContent = Math.round(predictions.hoursRemaining);
            }
        }

        if (predictionEl && predictions.confidence) {
            const confidence = Math.round(predictions.confidence * 100);
            predictionEl.textContent = `${confidence}% confidence`;
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)  }M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)  }K`;
        }
        return num.toString();
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
