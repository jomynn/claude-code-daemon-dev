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

        // Workspace status tracking
        this.currentProject = null;
        this.claudeStatus = 'stopped';
        this.bmadStatus = 'inactive';

        this.init();
    }

    async init() {
        this.setupWebSocket();
        this.setupCharts();
        this.setupWorkspaceStatus();
        this.setupSlackConnectionStatus();
        this.setupQuickActions();
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

    // Workspace Status Methods
    setupWorkspaceStatus() {
        // Load current workspace status
        this.loadWorkspaceStatus();

        // Set up periodic workspace status updates
        setInterval(() => {
            this.loadWorkspaceStatus();
        }, 5000); // Update every 5 seconds

        // Set up workspace control buttons
        const startClaudeBtn = document.getElementById('start-claude-dashboard-btn');
        const stopClaudeBtn = document.getElementById('stop-claude-dashboard-btn');
        const startBmadBtn = document.getElementById('start-bmad-dashboard-btn');
        const openWorkspaceBtn = document.getElementById('open-workspace-btn');

        if (startClaudeBtn) {
            startClaudeBtn.addEventListener('click', () => this.startClaude());
        }
        if (stopClaudeBtn) {
            stopClaudeBtn.addEventListener('click', () => this.stopClaude());
        }
        if (startBmadBtn) {
            startBmadBtn.addEventListener('click', () => this.startBmad());
        }
        if (openWorkspaceBtn) {
            openWorkspaceBtn.addEventListener('click', () => {
                // Share current project data with workspace
                let workspaceUrl = '/workspace';
                if (this.currentProject && this.currentProject.id) {
                    workspaceUrl += `?project=${this.currentProject.id}&from=dashboard`;

                    // Store current project data for sharing
                    localStorage.setItem('dashboard-current-project', JSON.stringify({
                        project: this.currentProject,
                        claudeStatus: this.claudeStatus,
                        bmadStatus: this.bmadStatus,
                        timestamp: new Date().toISOString()
                    }));
                }

                window.open(workspaceUrl, '_blank');
            });
        }
    }

    setupQuickActions() {
        const createProjectBtn = document.getElementById('create-project-action');
        const openWorkspaceBtn = document.getElementById('open-workspace-action');
        const viewProjectsBtn = document.getElementById('view-projects-action');
        const viewLogsBtn = document.getElementById('view-logs-action');

        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', () => {
                window.location.href = '/projects';
            });
        }
        if (openWorkspaceBtn) {
            openWorkspaceBtn.addEventListener('click', () => {
                // Share current project data with workspace (quick action)
                let workspaceUrl = '/workspace';
                if (this.currentProject && this.currentProject.id) {
                    workspaceUrl += `?project=${this.currentProject.id}&from=dashboard-quick`;

                    // Store current project data for sharing
                    localStorage.setItem('dashboard-current-project', JSON.stringify({
                        project: this.currentProject,
                        claudeStatus: this.claudeStatus,
                        bmadStatus: this.bmadStatus,
                        timestamp: new Date().toISOString()
                    }));
                }

                window.open(workspaceUrl, '_blank');
            });
        }
        if (viewProjectsBtn) {
            viewProjectsBtn.addEventListener('click', () => {
                window.location.href = '/projects';
            });
        }
        if (viewLogsBtn) {
            viewLogsBtn.addEventListener('click', () => {
                window.location.href = '/logs';
            });
        }
    }

    async loadWorkspaceStatus() {
        try {
            // Load projects
            const projectsResponse = await fetch('/api/projects');
            const projectsResult = await projectsResponse.json();

            if (projectsResult.success && projectsResult.data) {
                // Find active projects
                const activeProjects = projectsResult.data.filter(p =>
                    (p.projectStatus || 'active') === 'active'
                );

                // Update project status display
                this.updateProjectStatus(activeProjects);
            }

            // Load Claude status
            const claudeResponse = await fetch('/api/projects/claude/status');
            if (claudeResponse.ok) {
                const claudeResult = await claudeResponse.json();
                this.updateClaudeStatus(claudeResult.data || {});
            }
        } catch (error) {
            console.error('Error loading workspace status:', error);
        }
    }

    updateProjectStatus(activeProjects) {
        const projectNameEl = document.getElementById('active-project-name');
        const projectPathEl = document.getElementById('active-project-path');
        const projectPriorityEl = document.getElementById('active-project-priority');
        const projectActivityEl = document.getElementById('active-project-activity');
        const projectStatusBadge = document.getElementById('project-status-badge');
        const openWorkspaceBtn = document.getElementById('open-workspace-btn');

        if (activeProjects.length > 0) {
            // Show the most recently updated active project
            const currentProject = activeProjects.sort((a, b) =>
                new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
            )[0];

            this.currentProject = currentProject;

            if (projectNameEl) projectNameEl.textContent = currentProject.name;
            if (projectPathEl) {
                const shortPath = currentProject.targetFolder.length > 30
                    ? '...' + currentProject.targetFolder.slice(-30)
                    : currentProject.targetFolder;
                projectPathEl.textContent = shortPath;
                projectPathEl.title = currentProject.targetFolder;
            }
            if (projectPriorityEl) {
                const priority = currentProject.priority || 'normal';
                const priorityEmoji = {
                    'low': '🔵',
                    'normal': '⚪',
                    'high': '🟠',
                    'critical': '🔴'
                };
                projectPriorityEl.textContent = `${priorityEmoji[priority]} ${priority}`;
            }
            if (projectActivityEl) {
                const lastActivity = currentProject.updatedAt || currentProject.createdAt;
                projectActivityEl.textContent = this.formatRelativeTime(lastActivity);
            }
            if (projectStatusBadge) {
                projectStatusBadge.textContent = '✅ Active';
                projectStatusBadge.className = 'status-badge active';
            }
            if (openWorkspaceBtn) {
                openWorkspaceBtn.disabled = false;
                openWorkspaceBtn.textContent = 'Open Workspace';
            }
        } else {
            // No active projects
            if (projectNameEl) projectNameEl.textContent = 'None selected';
            if (projectPathEl) projectPathEl.textContent = '--';
            if (projectPriorityEl) projectPriorityEl.textContent = '--';
            if (projectActivityEl) projectActivityEl.textContent = '--';
            if (projectStatusBadge) {
                projectStatusBadge.textContent = 'No Project';
                projectStatusBadge.className = 'status-badge inactive';
            }
            if (openWorkspaceBtn) {
                openWorkspaceBtn.disabled = true;
                openWorkspaceBtn.textContent = 'No Project';
            }
        }
    }

    updateClaudeStatus(claudeData) {
        const statusIndicator = document.getElementById('claude-status-indicator');
        const sessionStatus = document.getElementById('claude-session-status');
        const sessionUptime = document.getElementById('claude-session-uptime');
        const currentModel = document.getElementById('claude-current-model');
        const messageCount = document.getElementById('claude-message-count');
        const startBtn = document.getElementById('start-claude-dashboard-btn');
        const stopBtn = document.getElementById('stop-claude-dashboard-btn');

        const isRunning = claudeData.running || false;
        const session = claudeData.session || {};

        this.claudeStatus = isRunning ? 'running' : 'stopped';

        if (statusIndicator) {
            if (isRunning) {
                statusIndicator.textContent = '🟢 Running';
                statusIndicator.className = 'status-badge running';
            } else {
                statusIndicator.textContent = '🔴 Stopped';
                statusIndicator.className = 'status-badge stopped';
            }
        }

        if (sessionStatus) {
            sessionStatus.textContent = isRunning ? 'Active session' : 'Not running';
        }

        if (sessionUptime) {
            if (isRunning && session.startedAt) {
                const startTime = new Date(session.startedAt);
                const uptime = this.formatUptime(Date.now() - startTime.getTime());
                sessionUptime.textContent = uptime;
            } else {
                sessionUptime.textContent = '00:00:00';
            }
        }

        if (messageCount) {
            messageCount.textContent = session.messageCount || 0;
        }

        if (startBtn) {
            startBtn.disabled = isRunning || !this.currentProject;
            startBtn.textContent = !this.currentProject ? 'No Project' : 'Start Claude';
        }

        if (stopBtn) {
            stopBtn.disabled = !isRunning;
        }
    }

    async startClaude() {
        if (!this.currentProject) {
            alert('Please select a project first');
            return;
        }

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/start-claude`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                this.showNotification('Claude Code started successfully', 'success');
                this.loadWorkspaceStatus(); // Refresh status
            } else {
                this.showNotification('Failed to start Claude Code: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error starting Claude Code: ' + error.message, 'error');
        }
    }

    async stopClaude() {
        if (!this.currentProject) return;

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/claude/stop`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                this.showNotification('Claude Code stopped', 'info');
                this.loadWorkspaceStatus(); // Refresh status
            } else {
                this.showNotification('Failed to stop Claude Code: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error stopping Claude Code: ' + error.message, 'error');
        }
    }

    async startBmad() {
        if (!this.currentProject) {
            alert('Please select a project first');
            return;
        }

        // For now, just show a notification
        this.showNotification('BMAD workflow functionality coming soon!', 'info');
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffHours < 1) {
            return `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else {
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays}d ago`;
        }
    }

    formatUptime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Slack Connection Status Methods
    setupSlackConnectionStatus() {
        // Load initial Slack status
        this.loadSlackStatus();

        // Set up periodic Slack status updates
        setInterval(() => {
            this.loadSlackStatus();
        }, 30000); // Update every 30 seconds

        // Set up Slack action buttons
        const testSlackBtn = document.getElementById('test-slack-connection');
        const configureSlackBtn = document.getElementById('configure-slack');

        if (testSlackBtn) {
            testSlackBtn.addEventListener('click', () => this.testSlackConnection());
        }
        if (configureSlackBtn) {
            configureSlackBtn.addEventListener('click', () => {
                window.location.href = '/slack-config';
            });
        }
    }

    async loadSlackStatus() {
        try {
            const response = await fetch('/api/slack/status');
            const result = await response.json();

            if (result.success) {
                this.updateSlackStatus(result.data);
            } else {
                // If API call fails, show as disconnected
                this.updateSlackStatus({
                    available: false,
                    initialized: false,
                    channels: {}
                });
            }
        } catch (error) {
            console.error('Error loading Slack status:', error);
            // If there's an error, show as disconnected
            this.updateSlackStatus({
                available: false,
                initialized: false,
                channels: {}
            });
        }
    }

    updateSlackStatus(status) {
        const slackConnectionBadge = document.getElementById('slack-connection-badge');
        const slackBotStatus = document.getElementById('slack-bot-status');
        const slackWorkspace = document.getElementById('slack-workspace');
        const slackChannelsCount = document.getElementById('slack-channels-count');
        const slackLastActivity = document.getElementById('slack-last-activity');
        const testSlackBtn = document.getElementById('test-slack-connection');
        const featureItems = document.querySelectorAll('.feature-item');

        const isConnected = status.available && status.initialized;
        const channels = status.channels || {};
        const channelCount = Object.keys(channels).length;

        // Update connection badge
        if (slackConnectionBadge) {
            if (isConnected) {
                slackConnectionBadge.textContent = 'Connected';
                slackConnectionBadge.className = 'slack-status-badge connected';
            } else {
                slackConnectionBadge.textContent = 'Disconnected';
                slackConnectionBadge.className = 'slack-status-badge disconnected';
            }
        }

        // Update bot status
        if (slackBotStatus) {
            slackBotStatus.textContent = isConnected ? 'Connected' : 'Not Connected';
        }

        // Update workspace info
        if (slackWorkspace) {
            slackWorkspace.textContent = status.workspace || '--';
        }

        // Update channels count
        if (slackChannelsCount) {
            slackChannelsCount.textContent = channelCount;
        }

        // Update last activity
        if (slackLastActivity) {
            if (isConnected) {
                slackLastActivity.textContent = 'Just now';
            } else {
                slackLastActivity.textContent = 'Never';
            }
        }

        // Update test button
        if (testSlackBtn) {
            testSlackBtn.disabled = !isConnected;
        }

        // Update feature indicators
        featureItems.forEach(item => {
            const feature = item.getAttribute('data-feature');
            if (isConnected) {
                // Check if specific feature is configured
                let featureEnabled = false;
                switch (feature) {
                    case 'alerts':
                        featureEnabled = channels.alerts || channels.general;
                        break;
                    case 'status':
                        featureEnabled = channels.status || channels.general;
                        break;
                    case 'commands':
                        featureEnabled = channels.commands || channels.general;
                        break;
                    case 'notifications':
                        featureEnabled = channelCount > 0;
                        break;
                    default:
                        featureEnabled = isConnected;
                }

                if (featureEnabled) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            } else {
                item.classList.remove('active');
            }
        });
    }

    async testSlackConnection() {
        const testBtn = document.getElementById('test-slack-connection');
        if (!testBtn) return;

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';

        try {
            const response = await fetch('/api/slack/status');
            const result = await response.json();

            if (result.success && result.data.initialized) {
                this.showNotification('✅ Slack connection successful!', 'success');
            } else {
                this.showNotification('❌ Slack connection failed. Check configuration.', 'error');
            }
        } catch (error) {
            this.showNotification('❌ Error testing Slack connection: ' + error.message, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Connection';
        }
    }

    showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--card-bg);
            color: var(--text-primary);
            padding: 15px 20px;
            border-radius: 8px;
            border-left: 4px solid ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)'};
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            max-width: 300px;
            transition: all 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
