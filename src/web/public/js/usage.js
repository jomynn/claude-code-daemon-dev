/**
 * Usage Analytics JavaScript
 * Advanced usage analytics dashboard with charts and predictions
 */

class UsageAnalytics {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.currentData = [];
        this.currentPeriod = 'day';

        this.init();
    }

    async init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupCharts();
        await this.loadData();
    }

    setupWebSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            this.socket.emit('subscribe', 'usage');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
        });

        this.socket.on('usage-update', (data) => {
            this.handleUsageUpdate(data);
        });
    }

    setupEventListeners() {
        // Time range selector
        document.getElementById('time-range').addEventListener('change', (e) => {
            this.currentPeriod = e.target.value;
            this.loadData();
        });

        // Export button
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadData();
        });

        // Search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterTable(e.target.value);
        });
    }

    setupCharts() {
        // Tokens chart (main timeline)
        const tokensCtx = document.getElementById('tokens-chart').getContext('2d');
        this.charts.tokens = new Chart(tokensCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Tokens Used',
                    data: [],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Predicted Usage',
                    data: [],
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#404040',
                        borderWidth: 1
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
                            color: '#b0b0b0',
                            callback: function(value) {
                                return value >= 1000000 ? `${(value / 1000000).toFixed(1)  }M` :
                                    value >= 1000 ? `${(value / 1000).toFixed(1)  }K` : value;
                            }
                        },
                        grid: {
                            color: '#404040'
                        }
                    }
                }
            }
        });

        // Distribution chart (pie/doughnut)
        const distributionCtx = document.getElementById('distribution-chart').getContext('2d');
        this.charts.distribution = new Chart(distributionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Morning', 'Afternoon', 'Evening', 'Night'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        '#2196F3',
                        '#4CAF50',
                        '#FF9800',
                        '#9C27B0'
                    ],
                    borderWidth: 2,
                    borderColor: '#1a1a1a'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff'
                    }
                }
            }
        });

        // Pattern chart (requests over time)
        const patternCtx = document.getElementById('pattern-chart').getContext('2d');
        this.charts.pattern = new Chart(patternCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Requests',
                    data: [],
                    backgroundColor: 'rgba(76, 175, 80, 0.7)',
                    borderColor: '#4CAF50',
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

        // Prediction chart
        const predictionCtx = document.getElementById('prediction-chart').getContext('2d');
        this.charts.prediction = new Chart(predictionCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Historical',
                    data: [],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Predicted',
                    data: [],
                    borderColor: '#FF5722',
                    backgroundColor: 'rgba(255, 87, 34, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.4
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

    async loadData() {
        try {
            const hours = this.getPeriodHours();

            // Load usage history
            const historyResponse = await fetch(`/api/usage/history?hours=${hours}`);
            const historyData = await historyResponse.json();

            if (historyData.success) {
                this.currentData = historyData.data;
                this.updateCharts();
                this.updateStats();
                this.updateTable();
            }

            // Load predictions
            const predictionsResponse = await fetch('/api/usage/predictions');
            const predictionsData = await predictionsResponse.json();

            if (predictionsData.success && predictionsData.data) {
                this.updatePredictions(predictionsData.data);
            }

        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    getPeriodHours() {
        const periods = {
            hour: 1,
            day: 24,
            week: 168,
            month: 720
        };
        return periods[this.currentPeriod] || 24;
    }

    updateCharts() {
        if (!this.currentData || this.currentData.length === 0) {return;}

        // Sort data by timestamp
        const sortedData = [...this.currentData].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Update tokens chart
        this.updateTokensChart(sortedData);

        // Update distribution chart
        this.updateDistributionChart(sortedData);

        // Update pattern chart
        this.updatePatternChart(sortedData);
    }

    updateTokensChart(data) {
        const labels = data.map(d => this.formatTimestamp(d.timestamp));
        const tokens = data.map(d => d.tokens || 0);

        this.charts.tokens.data.labels = labels;
        this.charts.tokens.data.datasets[0].data = tokens;
        this.charts.tokens.update();
    }

    updateDistributionChart(data) {
        // Calculate usage distribution by time of day
        const distribution = [0, 0, 0, 0]; // Morning, Afternoon, Evening, Night

        data.forEach(d => {
            const hour = new Date(d.timestamp).getHours();
            if (hour >= 6 && hour < 12) {distribution[0] += d.tokens || 0;} // Morning
            else if (hour >= 12 && hour < 18) {distribution[1] += d.tokens || 0;} // Afternoon
            else if (hour >= 18 && hour < 22) {distribution[2] += d.tokens || 0;} // Evening
            else {distribution[3] += d.tokens || 0;} // Night
        });

        this.charts.distribution.data.datasets[0].data = distribution;
        this.charts.distribution.update();
    }

    updatePatternChart(data) {
        // Group by hour for pattern analysis
        const hourlyData = {};
        data.forEach(d => {
            const hour = new Date(d.timestamp).getHours();
            hourlyData[hour] = (hourlyData[hour] || 0) + (d.requests || 0);
        });

        const labels = Object.keys(hourlyData).sort((a, b) => a - b).map(h => `${h}:00`);
        const requests = labels.map(label => hourlyData[parseInt(label)] || 0);

        this.charts.pattern.data.labels = labels;
        this.charts.pattern.data.datasets[0].data = requests;
        this.charts.pattern.update();
    }

    updateStats() {
        if (!this.currentData || this.currentData.length === 0) {return;}

        const tokens = this.currentData.map(d => d.tokens || 0);
        const rates = this.currentData.map(d => d.tokens_per_hour || 0);

        // Total tokens
        const totalTokens = Math.max(...tokens);
        document.getElementById('total-tokens').textContent = this.formatNumber(totalTokens);

        // Average rate
        const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
        document.getElementById('avg-rate').textContent = Math.round(avgRate);

        // Peak usage
        const peakUsage = Math.max(...rates);
        document.getElementById('peak-usage').textContent = Math.round(peakUsage);
    }

    updatePredictions(predictions) {
        // Update prediction details
        if (predictions.predictedLimitTime) {
            const date = new Date(predictions.predictedLimitTime);
            document.getElementById('predicted-time').textContent = date.toLocaleString();
        }

        if (predictions.confidence) {
            const confidence = Math.round(predictions.confidence * 100);
            document.getElementById('confidence-level').textContent = `${confidence}%`;
            document.getElementById('prediction-accuracy').textContent = `${confidence}%`;
        }

        // Update trend
        const trend = predictions.averageRate > 100 ? 'Increasing' :
            predictions.averageRate > 50 ? 'Stable' : 'Decreasing';
        document.getElementById('usage-trend').textContent = trend;

        // Update recommendation
        let recommendation = 'Monitor usage';
        if (predictions.hoursRemaining < 4) {
            recommendation = 'Urgent: Limit approaching';
        } else if (predictions.hoursRemaining < 12) {
            recommendation = 'Consider reducing usage';
        }
        document.getElementById('recommendation').textContent = recommendation;

        // Update prediction chart
        this.updatePredictionChart(predictions);
    }

    updatePredictionChart(predictions) {
        // Generate prediction data points
        const now = new Date();
        const hours = 24;
        const labels = [];
        const historical = [];
        const predicted = [];

        for (let i = -hours; i <= hours; i++) {
            const time = new Date(now.getTime() + i * 60 * 60 * 1000);
            labels.push(time.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }));

            if (i <= 0) {
                // Historical data
                const rate = predictions.averageRate || 0;
                historical.push(Math.max(0, rate * (hours + i)));
                predicted.push(null);
            } else {
                // Predicted data
                historical.push(null);
                const rate = predictions.averageRate || 0;
                predicted.push(rate * i);
            }
        }

        this.charts.prediction.data.labels = labels;
        this.charts.prediction.data.datasets[0].data = historical;
        this.charts.prediction.data.datasets[1].data = predicted;
        this.charts.prediction.update();
    }

    updateTable() {
        const tbody = document.querySelector('#usage-data-table tbody');
        if (!tbody) {return;}

        tbody.innerHTML = '';

        // Show latest 50 entries
        const recentData = [...this.currentData]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);

        recentData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(item.timestamp).toLocaleString()}</td>
                <td>${this.formatNumber(item.tokens || 0)}</td>
                <td>${item.requests || 0}</td>
                <td>${Math.round(item.tokens_per_hour || 0)}</td>
                <td>${Math.round(item.requests_per_hour || 0)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    filterTable(searchTerm) {
        const rows = document.querySelectorAll('#usage-data-table tbody tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    handleUsageUpdate(data) {
        // Add new data point and refresh
        this.currentData.push(data);

        // Keep only relevant data for current period
        const cutoffTime = new Date(Date.now() - this.getPeriodHours() * 60 * 60 * 1000);
        this.currentData = this.currentData.filter(d =>
            new Date(d.timestamp) > cutoffTime
        );

        this.updateCharts();
        this.updateStats();
    }

    async exportData() {
        try {
            const hours = this.getPeriodHours();
            const format = 'csv'; // Could be made configurable

            const response = await fetch(`/api/usage/export?format=${format}&hours=${hours}`);

            if (format === 'csv') {
                const csv = await response.text();
                this.downloadFile(csv, `usage-data-${this.currentPeriod}.csv`, 'text/csv');
            } else {
                const json = await response.json();
                this.downloadFile(
                    JSON.stringify(json, null, 2),
                    `usage-data-${this.currentPeriod}.json`,
                    'application/json'
                );
            }
        } catch (error) {
            console.error('Error exporting data:', error);
        }
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

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);

        if (this.currentPeriod === 'hour') {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } else if (this.currentPeriod === 'day') {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                hour12: false
            });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
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

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = `status-dot ${connected ? '' : 'offline'}`;
        }
    }
}

// Initialize usage analytics when page loads
document.addEventListener('DOMContentLoaded', () => {
    new UsageAnalytics();
});
