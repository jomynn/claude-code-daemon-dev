/**
 * Workspace Manager
 * Handles integrated workspace with terminals, Claude Code, and BMAD
 */

class WorkspaceManager {
    constructor() {
        this.currentProject = null;
        this.terminals = new Map();
        this.claudeSession = null;
        this.bmadAgents = new Map();
        this.socket = null;
        this.activeTab = 'overview';

        this.init();
    }

    async init() {
        console.log('Initializing WorkspaceManager...');
        try {
            console.log('Step 1: Setting up event listeners...');
            this.setupEventListeners();
            console.log('Step 2: Setting up socket connection...');
            this.setupSocketConnection();
            console.log('Step 3: About to load projects...');
            await this.loadProjects();
            console.log('Step 4: Initializing tabs...');
            this.initializeTabs();
            console.log('Step 5: Starting resource monitoring...');
            this.startResourceMonitoring();
            console.log('Step 6: Setting up project creation...');
            this.setupProjectCreation();
            console.log('WorkspaceManager initialization complete');
        } catch (error) {
            console.error('Error during WorkspaceManager initialization:', error);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        console.log('Found tab buttons:', tabButtons.length);
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Project selector
        const projectSelector = document.getElementById('project-selector');
        console.log('Found project selector:', !!projectSelector);
        if (projectSelector) {
            projectSelector.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadProject(e.target.value);
                }
            });
        }

        // Claude Code controls - with error handling
        const startClaudeBtn = document.getElementById('start-claude-btn');
        if (startClaudeBtn) {
            startClaudeBtn.addEventListener('click', () => {
                this.startClaude();
            });
        }

        const stopClaudeBtn = document.getElementById('stop-claude-btn');
        if (stopClaudeBtn) {
            stopClaudeBtn.addEventListener('click', () => {
                this.stopClaude();
            });
        }

        const restartClaudeBtn = document.getElementById('restart-claude-btn');
        if (restartClaudeBtn) {
            restartClaudeBtn.addEventListener('click', () => {
                this.restartClaude();
            });
        }

        const holdClaudeBtn = document.getElementById('hold-claude-btn');
        if (holdClaudeBtn) {
            holdClaudeBtn.addEventListener('click', () => {
                this.holdClaude();
            });
        }

        const resumeClaudeBtn = document.getElementById('resume-claude-btn');
        if (resumeClaudeBtn) {
            resumeClaudeBtn.addEventListener('click', () => {
                this.resumeClaude();
            });
        }

        // Claude input - with error handling
        const claudeInput = document.getElementById('claude-input');
        if (claudeInput) {
            claudeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendClaudeMessage();
                }
            });
        }

        const sendClaudeBtn = document.getElementById('send-claude-btn');
        if (sendClaudeBtn) {
            sendClaudeBtn.addEventListener('click', () => {
                this.sendClaudeMessage();
            });
        }

        // Collaboration input - with error handling
        const collabInput = document.getElementById('collab-input');
        if (collabInput) {
            collabInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendCollabMessage();
                }
            });
        }

        // New workspace button - with error handling
        const newWorkspaceBtn = document.getElementById('new-workspace-btn');
        if (newWorkspaceBtn) {
            newWorkspaceBtn.addEventListener('click', () => {
                this.createNewWorkspace();
            });
        }

        // Split view and fullscreen - with error handling
        const splitViewBtn = document.getElementById('split-view-btn');
        if (splitViewBtn) {
            splitViewBtn.addEventListener('click', () => {
                this.toggleSplitView();
            });
        }

        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Reload projects button
        document.getElementById('reload-projects-btn').addEventListener('click', () => {
            console.log('🔄 Manual reload projects button clicked');
            this.loadProjects();
        });

        // Night mode status monitoring
        this.initNightModeStatus();
    }

    setupSocketConnection() {
        this.socket = io();

        this.socket.on('connect', () => {
            document.getElementById('connection-status').classList.remove('disconnected');
            this.addActivity('Connected to server');
        });

        this.socket.on('disconnect', () => {
            document.getElementById('connection-status').classList.add('disconnected');
            this.addActivity('Disconnected from server');
        });

        // Terminal output
        this.socket.on('terminal-output', (data) => {
            this.handleTerminalOutput(data);
        });

        // Claude output
        this.socket.on('claude-output', (data) => {
            this.handleClaudeOutput(data);
        });

        // BMAD updates
        this.socket.on('bmad-update', (data) => {
            this.handleBmadUpdate(data);
        });

        // Night mode events
        this.socket.on('night-mode:started', (data) => {
            this.handleNightModeStarted(data);
        });

        this.socket.on('night-mode:stopped', (data) => {
            this.handleNightModeStopped(data);
        });

        this.socket.on('night-mode:phase-completed', (data) => {
            this.handleNightModePhaseCompleted(data);
        });

        this.socket.on('night-mode:project-completed', (data) => {
            this.handleNightModeProjectCompleted(data);
        });
    }

    async loadProjects() {
        try {
            console.log('🔄 Starting loadProjects...');
            const selector = document.getElementById('project-selector');
            const container = document.querySelector('.project-selector-container');
            const countBadge = document.getElementById('project-count-badge');
            console.log('🎯 Project selector element:', selector);

            if (!selector) {
                console.error('❌ Project selector element not found!');
                return;
            }

            // Show loading state
            selector.innerHTML = '<option value="">Loading projects...</option>';
            selector.disabled = true;
            if (container) container.classList.add('loading');
            if (countBadge) countBadge.style.display = 'none';
            console.log('⏳ Set loading state');

            const response = await fetch('/api/projects');
            console.log('📡 Fetch response status:', response.status, response.ok);
            const result = await response.json();
            console.log('📋 Projects API response:', result);
            console.log('📊 Number of projects:', result.data ? result.data.length : 'No data');

            if (result.success && result.data) {
                selector.innerHTML = '<option value="">Select Project...</option>';
                selector.disabled = false;
                console.log('✅ Reset selector to default state');

                // Filter to only show active projects in workspace
                const activeProjects = result.data.filter(project => {
                    const status = project.projectStatus || 'active';
                    return status === 'active';
                });
                console.log(`🔍 Filtered to ${activeProjects.length} active projects (from ${result.data.length} total)`);

                if (activeProjects.length === 0) {
                    const noProjectsOption = document.createElement('option');
                    noProjectsOption.value = '';
                    noProjectsOption.textContent = 'No active projects found';
                    noProjectsOption.disabled = true;
                    selector.appendChild(noProjectsOption);
                    console.log('📝 Added "No active projects found" option');
                } else {
                    // Add only active projects
                    activeProjects.forEach((project, index) => {
                        const option = document.createElement('option');
                        option.value = project.id;

                        // Format project name with better readability
                        const projectName = project.name.length > 30
                            ? project.name.substring(0, 27) + '...'
                            : project.name;

                        // Extract just the folder name from the full path for cleaner display
                        const folderName = project.targetFolder.split('/').pop() || project.targetFolder;

                        option.textContent = `${projectName} — ${folderName}`;
                        option.title = `${project.name} - ${project.targetFolder}`;
                        selector.appendChild(option);
                        console.log(`✨ Added active project ${index + 1}/${activeProjects.length}: ${project.name} (ID: ${project.id})`);
                    });

                    // Verify all options were added
                    const optionCount = selector.options.length;
                    console.log(`🔍 Selector now has ${optionCount} options/groups`);
                }

                console.log(`🎉 Successfully loaded ${activeProjects.length} active projects (${result.data.length} total)`);

                // Update project count badge to show only active projects
                if (countBadge) {
                    countBadge.textContent = activeProjects.length.toString();
                    countBadge.style.display = 'inline-block';
                    countBadge.title = `${activeProjects.length} active project${activeProjects.length !== 1 ? 's' : ''} available (${result.data.length} total)`;
                }

                // Add a visual indicator that projects have been loaded
                selector.style.borderLeft = '3px solid #28a745';
                setTimeout(() => {
                    selector.style.borderLeft = '';
                }, 2000);

                // Remove loading state
                if (container) container.classList.remove('loading');
            } else {
                console.error('❌ Projects API returned error:', result);
                selector.innerHTML = '<option value="">Error loading projects</option>';
                selector.disabled = true;
                if (container) container.classList.remove('loading');
            }
        } catch (error) {
            console.error('💥 Error loading projects:', error);
            const selector = document.getElementById('project-selector');
            const container = document.querySelector('.project-selector-container');
            if (selector) {
                selector.innerHTML = '<option value="">Error loading projects</option>';
                selector.disabled = true;
            }
            if (container) container.classList.remove('loading');
        }
    }

    async loadProject(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}`);
            const result = await response.json();

            if (result.success) {
                this.currentProject = result.data;
                this.updateProjectInfo();
                this.loadProjectFiles();
                this.loadProjectTerminals();
                this.checkClaudeStatus();
                this.loadBmadConfiguration();
                this.addActivity(`Loaded project: ${this.currentProject.name}`);
            }
        } catch (error) {
            console.error('Error loading project:', error);
        }
    }

    updateProjectInfo() {
        if (!this.currentProject) return;

        const infoBar = document.getElementById('project-info-bar');
        infoBar.style.display = 'flex';

        document.getElementById('current-project-name').textContent = this.currentProject.name;
        document.getElementById('current-project-path').textContent = this.currentProject.targetFolder;

        // Update stats will be called by other methods
    }

    initializeTabs() {
        this.switchTab('overview');
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab content
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        this.activeTab = tabName;

        // Initialize tab-specific functionality
        if (tabName === 'terminal') {
            this.initializeTerminalTab();
        } else if (tabName === 'claude') {
            this.initializeClaudeTab();
        } else if (tabName === 'bmad') {
            this.initializeBmadTab();
        } else if (tabName === 'files') {
            this.initializeFilesTab();
        }
    }

    // Terminal Management
    async createNewTerminal() {
        if (!this.currentProject) {
            alert('Please select a project first');
            return;
        }

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/terminal/create`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                const terminal = result.data;
                this.terminals.set(terminal.terminalId, {
                    ...terminal,
                    element: null,
                    xterm: null
                });

                this.addTerminalToUI(terminal);
                this.addActivity(`Created terminal: ${terminal.terminalId}`);
                return terminal;
            }
        } catch (error) {
            console.error('Error creating terminal:', error);
        }
    }

    addTerminalToUI(terminal) {
        // Add to terminal list
        const terminalList = document.getElementById('terminal-list');
        const terminalItem = document.createElement('div');
        terminalItem.className = 'terminal-item';
        terminalItem.dataset.terminalId = terminal.terminalId;
        terminalItem.innerHTML = `
            <div class="terminal-name">Terminal ${terminal.terminalId.split('-').pop()}</div>
            <div class="terminal-info">PID: ${terminal.pid}</div>
        `;
        terminalItem.addEventListener('click', () => {
            this.selectTerminal(terminal.terminalId);
        });
        terminalList.appendChild(terminalItem);

        // Create terminal tab
        const terminalTabs = document.getElementById('terminal-tabs');
        const tab = document.createElement('button');
        tab.className = 'terminal-tab';
        tab.dataset.terminalId = terminal.terminalId;
        tab.innerHTML = `
            Terminal ${terminal.terminalId.split('-').pop()}
            <span class="close-btn" onclick="workspaceManager.closeTerminal('${terminal.terminalId}')">&times;</span>
        `;
        tab.addEventListener('click', () => {
            this.selectTerminal(terminal.terminalId);
        });
        terminalTabs.appendChild(tab);

        // Create XTerm instance
        this.createXTermInstance(terminal.terminalId);

        // Select the new terminal
        this.selectTerminal(terminal.terminalId);
    }

    createXTermInstance(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        // Create XTerm instance
        const xterm = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: 'Courier New, monospace',
            theme: {
                background: '#000000',
                foreground: '#00ff00',
                cursor: '#00ff00',
                selection: 'rgba(255, 255, 255, 0.3)'
            }
        });

        // Create terminal element
        const terminalElement = document.createElement('div');
        terminalElement.className = 'terminal-instance';
        terminalElement.dataset.terminalId = terminalId;
        terminalElement.style.display = 'none';
        terminalElement.style.height = '100%';

        // Attach XTerm to element
        xterm.open(terminalElement);

        // Handle input
        xterm.onData((data) => {
            this.sendTerminalInput(terminalId, data);
        });

        // Store references
        terminal.element = terminalElement;
        terminal.xterm = xterm;

        // Add to container
        document.getElementById('terminal-container').appendChild(terminalElement);
    }

    selectTerminal(terminalId) {
        // Hide all terminals
        document.querySelectorAll('.terminal-instance').forEach(el => {
            el.style.display = 'none';
        });

        // Remove active class from all tabs and items
        document.querySelectorAll('.terminal-tab, .terminal-item').forEach(el => {
            el.classList.remove('active');
        });

        // Show selected terminal
        const terminal = this.terminals.get(terminalId);
        if (terminal && terminal.element) {
            terminal.element.style.display = 'block';
            if (terminal.xterm) {
                terminal.xterm.focus();
                // Trigger resize to ensure proper display
                setTimeout(() => terminal.xterm.fit && terminal.xterm.fit(), 100);
            }
        }

        // Activate tab and item
        document.querySelector(`[data-terminal-id="${terminalId}"]`).classList.add('active');
        document.querySelector(`.terminal-item[data-terminal-id="${terminalId}"]`).classList.add('active');

        // Hide no-terminal message
        document.querySelector('.no-terminal').style.display = 'none';
    }

    async sendTerminalInput(terminalId, data) {
        if (!this.currentProject) return;

        try {
            await fetch(`/api/projects/${this.currentProject.id}/terminal/${terminalId}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command: data })
            });
        } catch (error) {
            console.error('Error sending terminal input:', error);
        }
    }

    handleTerminalOutput(data) {
        const terminal = this.terminals.get(data.terminalId);
        if (terminal && terminal.xterm) {
            terminal.xterm.write(data.output);
        }
    }

    async closeTerminal(terminalId) {
        if (!this.currentProject) return;

        try {
            await fetch(`/api/projects/${this.currentProject.id}/terminal/${terminalId}`, {
                method: 'DELETE'
            });

            // Remove from UI
            document.querySelector(`[data-terminal-id="${terminalId}"]`).remove();
            document.querySelector(`.terminal-item[data-terminal-id="${terminalId}"]`).remove();

            // Clean up
            const terminal = this.terminals.get(terminalId);
            if (terminal && terminal.element) {
                terminal.element.remove();
            }
            this.terminals.delete(terminalId);

            this.addActivity(`Closed terminal: ${terminalId}`);
        } catch (error) {
            console.error('Error closing terminal:', error);
        }
    }

    async loadProjectTerminals() {
        if (!this.currentProject) return;

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/terminal/sessions`);
            const result = await response.json();

            if (result.success) {
                // Clear existing terminals
                this.terminals.clear();
                document.getElementById('terminal-list').innerHTML = '';
                document.getElementById('terminal-tabs').innerHTML = '';
                document.querySelectorAll('.terminal-instance').forEach(el => el.remove());

                // Add existing terminals
                result.data.forEach(terminal => {
                    this.terminals.set(terminal.terminalId, terminal);
                    this.addTerminalToUI(terminal);
                });

                // Update terminal count
                document.getElementById('terminal-count').textContent = result.data.length;
            }
        } catch (error) {
            console.error('Error loading project terminals:', error);
        }
    }

    initializeTerminalTab() {
        if (this.terminals.size === 0 && this.currentProject) {
            // Show no-terminal message
            document.querySelector('.no-terminal').style.display = 'flex';
        }
    }

    // Claude Code Management
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
                this.claudeSession = result.data;
                this.updateClaudeUI(true);
                this.addActivity('Claude Code started');
                this.addClaudeMessage('system', 'Claude Code session started. How can I help you?');
            }
        } catch (error) {
            console.error('Error starting Claude:', error);
        }
    }

    async stopClaude() {
        if (!this.currentProject || !this.claudeSession) return;

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/claude/stop`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                this.claudeSession = null;
                this.updateClaudeUI(false);
                this.addActivity('Claude Code stopped');
                this.addClaudeMessage('system', 'Claude Code session ended.');
            }
        } catch (error) {
            console.error('Error stopping Claude:', error);
        }
    }

    async restartClaude() {
        await this.stopClaude();
        setTimeout(() => this.startClaude(), 1000);
    }

    async holdClaude() {
        if (!this.currentProject || !this.claudeSession) {
            this.showNotification('No active Claude session to hold', 'warning');
            return;
        }

        try {
            // For now, we'll simulate a hold by marking the session as held
            // In a real implementation, this would pause the Claude process
            this.claudeSession.status = 'held';
            this.claudeSession.heldAt = new Date().toISOString();

            this.updateClaudeUI('held');
            this.addActivity('Claude Code session held');
            this.showNotification('Claude Code session held', 'info');

            // Disable input during hold
            const input = document.getElementById('claude-input');
            const sendBtn = document.getElementById('send-claude-btn');
            if (input) input.disabled = true;
            if (sendBtn) sendBtn.disabled = true;

        } catch (error) {
            console.error('Error holding Claude:', error);
            this.showNotification('Error holding Claude session: ' + error.message, 'error');
        }
    }

    async resumeClaude() {
        if (!this.currentProject || !this.claudeSession) {
            this.showNotification('No held Claude session to resume', 'warning');
            return;
        }

        try {
            // Resume the session
            this.claudeSession.status = 'running';
            this.claudeSession.resumedAt = new Date().toISOString();
            delete this.claudeSession.heldAt;

            this.updateClaudeUI('running');
            this.addActivity('Claude Code session resumed');
            this.showNotification('Claude Code session resumed', 'success');

            // Re-enable input
            const input = document.getElementById('claude-input');
            const sendBtn = document.getElementById('send-claude-btn');
            if (input) input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;

        } catch (error) {
            console.error('Error resuming Claude:', error);
            this.showNotification('Error resuming Claude session: ' + error.message, 'error');
        }
    }

    updateClaudeUI(status) {
        const statusDisplay = document.getElementById('claude-running-status');
        const statusBadge = document.getElementById('claude-status');
        const newStatusBadge = document.getElementById('claude-status-badge');
        const input = document.getElementById('claude-input');
        const sendBtn = document.getElementById('send-claude-btn');
        const startBtn = document.getElementById('start-claude-btn');
        const stopBtn = document.getElementById('stop-claude-btn');
        const restartBtn = document.getElementById('restart-claude-btn');
        const holdBtn = document.getElementById('hold-claude-btn');
        const resumeBtn = document.getElementById('resume-claude-btn');

        // Handle legacy boolean parameter for backward compatibility
        if (typeof status === 'boolean') {
            status = status ? 'running' : 'stopped';
        }

        // Reset all buttons first
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (restartBtn) restartBtn.disabled = true;
        if (holdBtn) holdBtn.disabled = true;
        if (resumeBtn) {
            resumeBtn.disabled = true;
            resumeBtn.style.display = 'none';
        }

        switch (status) {
            case 'running':
                if (statusDisplay) statusDisplay.textContent = 'Running';
                if (statusBadge) {
                    statusBadge.textContent = 'Running';
                    statusBadge.className = 'status-badge running';
                }
                if (newStatusBadge) {
                    newStatusBadge.textContent = '🟢 Running';
                    newStatusBadge.className = 'status-badge running';
                }
                if (input) input.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                if (restartBtn) restartBtn.disabled = false;
                if (holdBtn) holdBtn.disabled = false;
                break;

            case 'held':
                if (statusDisplay) statusDisplay.textContent = 'Held';
                if (statusBadge) {
                    statusBadge.textContent = 'Held';
                    statusBadge.className = 'status-badge held';
                }
                if (newStatusBadge) {
                    newStatusBadge.textContent = '⏸️ Held';
                    newStatusBadge.className = 'status-badge held';
                }
                if (input) input.disabled = true;
                if (sendBtn) sendBtn.disabled = true;
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                if (restartBtn) restartBtn.disabled = false;
                if (holdBtn) holdBtn.style.display = 'none';
                if (resumeBtn) {
                    resumeBtn.disabled = false;
                    resumeBtn.style.display = 'inline-block';
                }
                break;

            case 'stopped':
            default:
                if (statusDisplay) statusDisplay.textContent = 'Stopped';
                if (statusBadge) {
                    statusBadge.textContent = 'Stopped';
                    statusBadge.className = 'status-badge stopped';
                }
                if (newStatusBadge) {
                    newStatusBadge.textContent = '🔴 Stopped';
                    newStatusBadge.className = 'status-badge stopped';
                }
                if (input) input.disabled = true;
                if (sendBtn) sendBtn.disabled = true;
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) stopBtn.disabled = true;
                if (restartBtn) restartBtn.disabled = true;
                if (holdBtn) holdBtn.style.display = 'inline-block';
                break;
        }
    }

    async sendClaudeMessage() {
        const input = document.getElementById('claude-input');
        const message = input.value.trim();

        if (!message || !this.currentProject || !this.claudeSession) return;

        // Add user message to chat
        this.addClaudeMessage('user', message);
        input.value = '';

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/claude/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command: message })
            });
            const result = await response.json();

            if (result.success) {
                // Response will come via WebSocket
            }
        } catch (error) {
            console.error('Error sending Claude message:', error);
            this.addClaudeMessage('system', 'Error sending message to Claude Code.');
        }
    }

    addClaudeMessage(sender, content) {
        const messages = document.getElementById('claude-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        const time = new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <div class="message-header">${sender === 'user' ? 'You' : sender === 'claude' ? 'Claude' : 'System'} - ${time}</div>
            <div class="message-content">${content}</div>
        `;

        messages.appendChild(messageDiv);
        messages.scrollTop = messages.scrollHeight;

        // Remove welcome message if it exists
        const welcome = messages.querySelector('.welcome-message');
        if (welcome) {
            welcome.remove();
        }
    }

    handleClaudeOutput(data) {
        this.addClaudeMessage('claude', data.output);
    }

    async checkClaudeStatus() {
        if (!this.currentProject) return;

        try {
            const response = await fetch('/api/projects/claude/status');
            const result = await response.json();

            if (result.success) {
                const projectProcess = result.data[`claude-${this.currentProject.id}`];
                if (projectProcess) {
                    this.claudeSession = projectProcess;
                    this.updateClaudeUI(true);
                    this.startClaudeUptime();
                } else {
                    this.updateClaudeUI(false);
                }
            }
        } catch (error) {
            console.error('Error checking Claude status:', error);
        }
    }

    startClaudeUptime() {
        if (this.claudeUptimeInterval) {
            clearInterval(this.claudeUptimeInterval);
        }

        this.claudeUptimeInterval = setInterval(() => {
            if (this.claudeSession && this.claudeSession.startedAt) {
                const startTime = new Date(this.claudeSession.startedAt);
                const now = new Date();
                const diff = now - startTime;

                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                document.getElementById('claude-uptime').textContent =
                    `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    initializeClaudeTab() {
        // Initialize Claude tab if needed
    }

    // BMAD Management
    async loadBmadConfiguration() {
        if (!this.currentProject) return;

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/bmad`);
            const result = await response.json();

            if (result.success) {
                this.updateBmadWorkflow(result.data.config);
                document.getElementById('bmad-agent-count').textContent = result.data.config.agents.length;
            }
        } catch (error) {
            console.error('Error loading BMAD configuration:', error);
        }
    }

    updateBmadWorkflow(config) {
        const workflowSelect = document.getElementById('bmad-workflow-select');
        workflowSelect.value = config.workflow || 'agile';

        // Update workflow status
        const phases = document.querySelectorAll('.phase');
        phases.forEach((phase, index) => {
            if (config.phases && index < config.phases.length) {
                phase.textContent = config.phases[index];
                phase.classList.toggle('active', config.currentPhase === config.phases[index]);
            }
        });
    }

    async addBmadAgent() {
        // Define available BMAD agent roles with specialized configurations
        const agentRoles = {
            'dev': {
                name: 'Developer Agent',
                prompt: 'Expert software developer specializing in writing, debugging, and optimizing code',
                tools: ['terminal', 'editor', 'debugger', 'git'],
                workspaces: ['IDE', 'Terminal', 'Documentation']
            },
            'qa': {
                name: 'QA Testing Agent',
                prompt: 'Quality assurance specialist focused on testing, validation, and bug reporting',
                tools: ['testing-framework', 'browser-automation', 'performance-monitor'],
                workspaces: ['Test Suite', 'Bug Tracker', 'Performance Dashboard']
            },
            'pm': {
                name: 'Project Manager Agent',
                prompt: 'Project coordinator managing tasks, timelines, and team communication',
                tools: ['project-tracker', 'communication', 'reporting'],
                workspaces: ['Project Board', 'Timeline', 'Reports']
            },
            'devops': {
                name: 'DevOps Agent',
                prompt: 'Infrastructure and deployment specialist managing CI/CD and system operations',
                tools: ['docker', 'kubernetes', 'monitoring', 'deployment'],
                workspaces: ['Infrastructure', 'CI/CD Pipeline', 'Monitoring']
            },
            'architect': {
                name: 'System Architect Agent',
                prompt: 'Technical architect designing system structure and technology decisions',
                tools: ['modeling', 'documentation', 'analysis'],
                workspaces: ['Architecture Diagrams', 'Technical Specs', 'Decision Log']
            },
            'security': {
                name: 'Security Agent',
                prompt: 'Security specialist focused on vulnerability assessment and secure coding practices',
                tools: ['security-scanner', 'penetration-testing', 'audit'],
                workspaces: ['Security Dashboard', 'Vulnerability Reports', 'Compliance']
            }
        };

        // Create modal for agent selection
        const modal = this.createAgentSelectionModal(agentRoles);
        document.body.appendChild(modal);

        // Return promise that resolves when agent is selected
        return new Promise((resolve) => {
            modal.addEventListener('agent-selected', (event) => {
                const { agentType, config } = event.detail;
                const agentId = `agent-${Date.now()}`;
                const agent = {
                    id: agentId,
                    type: agentType,
                    name: `${agentType}-${agentId.split('-')[1]}`,
                    status: 'initializing',
                    config: config,
                    terminal: null,
                    workspace: []
                };

                this.bmadAgents.set(agentId, agent);
                this.addAgentToUI(agent);
                this.createAgentTerminal(agent);
                this.initializeAgentWorkspace(agent);
                this.addActivity(`Added BMAD agent: ${agent.name} (${config.name})`);

                document.body.removeChild(modal);
                resolve(agent);
            });

            modal.addEventListener('cancelled', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
        });
    }

    createAgentSelectionModal(agentRoles) {
        const modal = document.createElement('div');
        modal.className = 'modal bmad-agent-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add BMAD Agent</h3>
                    <button class="modal-close" onclick="this.closest('.modal').dispatchEvent(new CustomEvent('cancelled'))">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Select an agent role to add to your BMAD workflow:</p>
                    <div class="agent-roles-grid">
                        ${Object.entries(agentRoles).map(([type, config]) => `
                            <div class="agent-role-card" data-agent-type="${type}">
                                <h4>${config.name}</h4>
                                <p>${config.prompt}</p>
                                <div class="tools-list">
                                    <strong>Tools:</strong> ${config.tools.join(', ')}
                                </div>
                                <div class="workspaces-list">
                                    <strong>Workspaces:</strong> ${config.workspaces.join(', ')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="this.closest('.modal').dispatchEvent(new CustomEvent('cancelled'))">Cancel</button>
                </div>
            </div>
        `;

        // Add click handlers for agent role cards
        modal.querySelectorAll('.agent-role-card').forEach(card => {
            card.addEventListener('click', () => {
                const agentType = card.dataset.agentType;
                const config = agentRoles[agentType];
                modal.dispatchEvent(new CustomEvent('agent-selected', {
                    detail: { agentType, config }
                }));
            });
        });

        return modal;
    }

    initializeAgentWorkspace(agent) {
        // Initialize specialized workspace for each agent type
        const agentTerminal = document.getElementById(`agent-terminal-${agent.id}`);

        // Add role-specific initialization commands
        const initCommands = this.getAgentInitCommands(agent.type);
        initCommands.forEach(command => {
            this.addAgentTerminalOutput(agent.id, `$ ${command}`, 'command');

            // Simulate command execution
            setTimeout(() => {
                this.addAgentTerminalOutput(agent.id, `✓ ${command} completed`, 'success');
            }, Math.random() * 1000 + 500);
        });

        // Update agent status
        setTimeout(() => {
            agent.status = 'active';
            this.updateAgentStatus(agent.id, 'active');
        }, 2000);
    }

    getAgentInitCommands(agentType) {
        const commandSets = {
            'dev': [
                'Setting up development environment',
                'Loading code analysis tools',
                'Initializing Git integration',
                'Configuring debugging tools'
            ],
            'qa': [
                'Initializing test frameworks',
                'Setting up automated testing',
                'Loading browser automation tools',
                'Configuring performance monitoring'
            ],
            'pm': [
                'Loading project management tools',
                'Syncing with task tracker',
                'Setting up communication channels',
                'Initializing reporting dashboard'
            ],
            'devops': [
                'Connecting to infrastructure',
                'Setting up CI/CD pipeline',
                'Loading deployment tools',
                'Initializing monitoring systems'
            ],
            'architect': [
                'Loading system modeling tools',
                'Initializing documentation system',
                'Setting up design patterns library',
                'Configuring architecture analysis'
            ],
            'security': [
                'Loading security scanning tools',
                'Initializing vulnerability database',
                'Setting up penetration testing framework',
                'Configuring compliance monitoring'
            ]
        };

        return commandSets[agentType] || ['Initializing agent workspace'];
    }

    addAgentTerminalOutput(agentId, output, type = 'output') {
        const terminal = document.getElementById(`agent-terminal-${agentId}`);
        if (!terminal) return;

        const outputLine = document.createElement('div');
        outputLine.className = `terminal-line ${type}`;
        outputLine.textContent = output;

        terminal.appendChild(outputLine);
        terminal.scrollTop = terminal.scrollHeight;
    }

    updateAgentStatus(agentId, status) {
        const agentItem = document.querySelector(`.agent-item[data-agent-id="${agentId}"]`);
        if (agentItem) {
            const statusElement = agentItem.querySelector('.agent-status');
            statusElement.textContent = status;
            statusElement.className = `agent-status ${status}`;
        }

        // Update the agent object
        const agent = this.bmadAgents.get(agentId);
        if (agent) {
            agent.status = status;
        }
    }

    addAgentToUI(agent) {
        const agentList = document.getElementById('agent-list');
        const agentItem = document.createElement('div');
        agentItem.className = 'agent-item';
        agentItem.dataset.agentId = agent.id;
        agentItem.innerHTML = `
            <div class="agent-name">${agent.name}</div>
            <div class="agent-role">${agent.type}</div>
            <div class="agent-status ${agent.status}">${agent.status}</div>
        `;
        agentItem.addEventListener('click', () => {
            this.selectAgent(agent.id);
        });
        agentList.appendChild(agentItem);
    }

    createAgentTerminal(agent) {
        const agentTerminals = document.getElementById('agent-terminals');
        const terminalDiv = document.createElement('div');
        terminalDiv.className = 'agent-terminal';
        terminalDiv.dataset.agentId = agent.id;
        terminalDiv.innerHTML = `
            <div class="agent-terminal-header">${agent.name} Terminal</div>
            <div class="agent-terminal-content" id="agent-terminal-${agent.id}">
                $ ${agent.name} initialized<br>
                $ Waiting for commands...<br>
            </div>
        `;
        agentTerminals.appendChild(terminalDiv);
    }

    selectAgent(agentId) {
        document.querySelectorAll('.agent-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-agent-id="${agentId}"]`).classList.add('active');
    }

    async startBmadWorkflow() {
        if (!this.currentProject) {
            alert('Please select a project first');
            return;
        }

        const workflow = document.getElementById('bmad-workflow-select').value;

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/start-bmad`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workflowType: workflow })
            });
            const result = await response.json();

            if (result.success) {
                this.addActivity(`Started BMAD workflow: ${workflow}`);
                this.sendCollabMessage(`Started ${workflow} workflow`);
            }
        } catch (error) {
            console.error('Error starting BMAD workflow:', error);
        }
    }

    sendCollabMessage() {
        const input = document.getElementById('collab-input');
        const message = input.value.trim();

        if (!message) return;

        this.addCollabMessage('Coordinator', message);
        input.value = '';

        // Simulate agent responses
        setTimeout(() => {
            this.addCollabMessage('dev-agent', 'Acknowledged, proceeding with development tasks');
        }, 1000);
    }

    addCollabMessage(agentName, message) {
        const feed = document.getElementById('collaboration-feed');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'collab-message';

        const time = new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <span class="agent-name">${agentName}</span>
            <span class="message">${message}</span>
            <span class="timestamp">${time}</span>
        `;

        feed.appendChild(messageDiv);
        feed.scrollTop = feed.scrollHeight;
    }

    handleBmadUpdate(data) {
        this.addCollabMessage(data.agent || 'System', data.message);
    }

    initializeBmadTab() {
        // Initialize BMAD tab if needed
    }

    // File Explorer
    async loadProjectFiles() {
        if (!this.currentProject) return;

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/files`);
            const result = await response.json();

            if (result.success) {
                this.renderFileTree(result.data);
            }
        } catch (error) {
            console.error('Error loading project files:', error);
        }
    }

    renderFileTree(fileData) {
        const fileTree = document.getElementById('file-tree');
        fileTree.innerHTML = this.renderFileNode(fileData);
    }

    renderFileNode(node, level = 0) {
        const indent = '  '.repeat(level);
        let html = '';

        if (node.type === 'directory') {
            html += `<div class="folder-item" style="margin-left: ${level * 12}px">📁 ${node.name}</div>`;
            if (node.children) {
                node.children.forEach(child => {
                    html += this.renderFileNode(child, level + 1);
                });
            }
        } else {
            html += `<div class="file-item" style="margin-left: ${level * 12}px" onclick="workspaceManager.openFile('${node.path}')">📄 ${node.name}</div>`;
        }

        return html;
    }

    async openFile(filePath) {
        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/files/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filePath })
            });
            const result = await response.json();

            if (result.success) {
                this.displayFileContent(filePath, result.data.content);
            }
        } catch (error) {
            console.error('Error opening file:', error);
        }
    }

    displayFileContent(filePath, content) {
        const fileEditor = document.getElementById('file-editor');
        fileEditor.innerHTML = `
            <div class="file-header">
                <h4>${filePath.split('/').pop()}</h4>
                <span>${filePath}</span>
            </div>
            <pre class="file-content">${content}</pre>
        `;

        // Remove no-file-selected message
        document.querySelector('.no-file-selected').style.display = 'none';
    }

    initializeFilesTab() {
        if (this.currentProject) {
            this.loadProjectFiles();
        }
    }

    // Utility Methods
    addActivity(message) {
        const feed = document.getElementById('activity-feed');
        const item = document.createElement('div');
        item.className = 'activity-item fade-in';

        const time = new Date().toLocaleTimeString();
        item.innerHTML = `
            <span class="activity-time">${time}</span>
            <span class="activity-text">${message}</span>
        `;

        feed.insertBefore(item, feed.firstChild);

        // Limit to 10 items
        while (feed.children.length > 10) {
            feed.removeChild(feed.lastChild);
        }
    }

    startResourceMonitoring() {
        // Simulate resource monitoring
        setInterval(() => {
            const cpuUsage = Math.random() * 100;
            const memUsage = Math.random() * 100;

            document.querySelector('.resource-item:nth-child(1) .progress-fill').style.width = `${cpuUsage}%`;
            document.querySelector('.resource-item:nth-child(1) span:last-child').textContent = `${Math.round(cpuUsage)}%`;

            document.querySelector('.resource-item:nth-child(2) .progress-fill').style.width = `${memUsage}%`;
            document.querySelector('.resource-item:nth-child(2) span:last-child').textContent = `${Math.round(memUsage)}%`;
        }, 5000);
    }

    createNewWorkspace() {
        if (confirm('Create a new workspace? This will clear the current session.')) {
            window.location.reload();
        }
    }

    toggleSplitView() {
        // Implementation for split view
        alert('Split view feature coming soon!');
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    // Quick action methods
    openTerminal() {
        this.switchTab('terminal');
        this.createNewTerminal();
    }

    openFiles() {
        this.switchTab('files');
    }

    startBmad() {
        this.switchTab('bmad');
        if (this.bmadAgents.size === 0) {
            this.addBmadAgent();
        }
    }

    // Project Creation
    setupProjectCreation() {
        this.currentStep = 0;
        this.steps = ['basic', 'claude', 'bmad', 'settings'];
        this.selectedTemplate = null;

        // New Project button - with error handling
        const newProjectBtn = document.getElementById('new-project-btn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                this.openNewProjectModal();
            });
            console.log('✅ New Project button listener added');
        }

        // BMAD Quick Start button - with error handling and correct ID
        const bmadQuickStartBtn = document.getElementById('bmad-quick-start-btn');
        if (bmadQuickStartBtn) {
            bmadQuickStartBtn.addEventListener('click', () => {
                this.openBmadQuickStartModal();
            });
            console.log('✅ BMAD Quick Start button listener added');
        }

        // Brainstorm button - with error handling
        const brainstormBtn = document.getElementById('brainstorm-btn');
        if (brainstormBtn) {
            brainstormBtn.addEventListener('click', () => {
                this.openBrainstormModal();
            });
            console.log('✅ Brainstorm button listener added');
        }

        // Step navigation - with error handling
        const nextStepBtn = document.getElementById('next-step-btn');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => {
                this.nextStep();
            });
        }

        const prevStepBtn = document.getElementById('prev-step-btn');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => {
                this.prevStep();
            });
        }

        // Create Project button (final step)
        const createProjectBtn = document.getElementById('create-project-btn');
        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', () => {
                this.createProject();
            });
            console.log('✅ Create Project button listener added');
        }

        // Toggle configurations - with error handling
        const enableClaude = document.getElementById('enable-claude');
        if (enableClaude) {
            enableClaude.addEventListener('change', (e) => {
                const claudeConfig = document.getElementById('claude-config');
                if (claudeConfig) {
                    claudeConfig.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        const enableBmad = document.getElementById('enable-bmad');
        if (enableBmad) {
            enableBmad.addEventListener('change', (e) => {
                const bmadConfig = document.getElementById('bmad-config');
                if (bmadConfig) {
                    bmadConfig.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        // Temperature range slider
        document.getElementById('claude-temperature').addEventListener('input', (e) => {
            document.querySelector('.range-value').textContent = e.target.value;
        });

        // Project name auto-path
        document.getElementById('project-name').addEventListener('input', (e) => {
            const name = e.target.value;
            const sanitized = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
            const pathInput = document.getElementById('project-path');
            if (!pathInput.value || pathInput.value.includes(pathInput.dataset.previousName)) {
                pathInput.value = `/Volumes/Extreme SSD/Workspace/${sanitized}`;
                pathInput.dataset.previousName = sanitized;
            }
        });

        // Setup BMAD Quick Start modal
        this.setupBmadQuickStart();

        // Project Brainstorm button
        document.getElementById('brainstorm-btn').addEventListener('click', () => {
            this.openBrainstormModal();
        });

        // Setup brainstorming functionality
        this.setupBrainstorming();
    }

    openNewProjectModal() {
        console.log('Opening New Project modal...');
        const modal = document.getElementById('new-project-modal');
        if (modal) {
            modal.style.display = 'flex';
            console.log('Modal displayed');
            try {
                this.resetProjectForm();
            } catch (error) {
                console.error('Error resetting form:', error);
            }
        } else {
            console.error('New Project modal not found');
            // Fallback: use simple prompt
            const projectName = prompt('Enter project name:');
            if (projectName) {
                alert(`Project creation for "${projectName}" will be implemented soon!`);
            }
        }
    }

    closeNewProjectModal() {
        document.getElementById('new-project-modal').style.display = 'none';
        this.resetProjectForm();
    }

    resetProjectForm() {
        console.log('Resetting project form...');
        this.currentStep = 0;

        const form = document.getElementById('new-project-form');
        if (form) {
            form.reset();
        } else {
            console.warn('new-project-form not found');
        }

        try {
            this.updateStepDisplay();
        } catch (error) {
            console.error('Error updating step display:', error);
        }

        // Reset configurations with error handling
        const claudeConfig = document.getElementById('claude-config');
        const bmadConfig = document.getElementById('bmad-config');
        const rangeValue = document.querySelector('.range-value');

        if (claudeConfig) claudeConfig.style.display = 'block';
        if (bmadConfig) bmadConfig.style.display = 'none';
        if (rangeValue) rangeValue.textContent = '0.7';
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            // Validate current step
            if (this.validateCurrentStep()) {
                this.currentStep++;
                this.updateStepDisplay();
            }
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    updateStepDisplay() {
        console.log('Updating step display to step:', this.currentStep, this.steps[this.currentStep]);

        // Hide all step sections
        const stepSections = document.querySelectorAll('.step-section');
        if (stepSections.length === 0) {
            console.warn('No step sections found');
            return;
        }

        stepSections.forEach(section => {
            section.classList.remove('active');
        });

        // Show current step
        const currentStepElement = document.getElementById(`step-${this.steps[this.currentStep]}`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        } else {
            console.error(`Step element not found: step-${this.steps[this.currentStep]}`);
        }

        // Update progress steps
        const progressSteps = document.querySelectorAll('.progress-steps .step');
        progressSteps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index < this.currentStep) {
                step.classList.add('completed');
            } else if (index === this.currentStep) {
                step.classList.add('active');
            }
        });

        // Update buttons with error handling
        const prevBtn = document.getElementById('prev-step-btn');
        const nextBtn = document.getElementById('next-step-btn');
        const createBtn = document.getElementById('create-project-btn');

        if (prevBtn) prevBtn.style.display = this.currentStep > 0 ? 'inline-block' : 'none';
        if (nextBtn) nextBtn.style.display = this.currentStep < this.steps.length - 1 ? 'inline-block' : 'none';
        if (createBtn) createBtn.style.display = this.currentStep === this.steps.length - 1 ? 'inline-block' : 'none';
    }

    validateCurrentStep() {
        const currentStepId = this.steps[this.currentStep];

        switch (currentStepId) {
            case 'basic':
                const name = document.getElementById('project-name').value.trim();
                const path = document.getElementById('project-path').value.trim();

                if (!name) {
                    alert('Please enter a project name');
                    return false;
                }

                if (!path) {
                    alert('Please enter a project directory');
                    return false;
                }
                break;

            case 'bmad':
                const bmadEnabled = document.getElementById('enable-bmad').checked;
                if (bmadEnabled) {
                    const selectedAgents = document.querySelectorAll('input[name="bmadAgents"]:checked');
                    if (selectedAgents.length === 0) {
                        alert('Please select at least one BMAD agent');
                        return false;
                    }
                }
                break;
        }

        return true;
    }

    browseDirectory() {
        // For web interface, we'll show a simple input dialog
        // In a real implementation, this could open a directory picker
        const currentPath = document.getElementById('project-path').value;
        const newPath = prompt('Enter project directory path:', currentPath || '/Volumes/Extreme SSD/Workspace/');

        if (newPath) {
            document.getElementById('project-path').value = newPath;
        }
    }

    async createProject() {
        if (!this.validateCurrentStep()) {
            return;
        }

        // Show loading state
        const createBtn = document.getElementById('create-project-btn');
        const originalText = createBtn.textContent;
        createBtn.textContent = 'Creating...';
        createBtn.disabled = true;

        try {
            const formData = this.collectFormData();

            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.addActivity(`Created new project: ${formData.name}`);
                this.closeNewProjectModal();
                await this.loadProjects(); // Refresh project list

                // Auto-select the new project
                setTimeout(() => {
                    const selector = document.getElementById('project-selector');
                    selector.value = result.data.id;
                    this.loadProject(result.data.id);
                }, 500);

                // Show success message
                this.showNotification('Project created successfully!', 'success');

                // Auto-start Claude Code if enabled
                if (formData.claudeConfig && formData.claudeConfig.enabled) {
                    setTimeout(() => {
                        this.startClaude();
                    }, 1000);
                }

                // Auto-start BMAD if enabled
                if (formData.bmadConfig && formData.bmadConfig.enabled) {
                    setTimeout(() => {
                        this.startBmadWorkflow();
                    }, 1500);
                }

            } else {
                throw new Error(result.message || 'Failed to create project');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            this.showNotification(`Error creating project: ${error.message}`, 'error');
        } finally {
            createBtn.textContent = originalText;
            createBtn.disabled = false;
        }
    }

    collectFormData() {
        // Helper function to safely get element value
        const getValue = (id, defaultValue = '') => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : defaultValue;
        };

        const getChecked = (id, defaultValue = false) => {
            const element = document.getElementById(id);
            return element ? element.checked : defaultValue;
        };

        const formData = {
            name: getValue('project-name'),
            description: getValue('project-description'),
            targetFolder: getValue('project-path'),
            template: getValue('project-template', 'blank'),
            githubRepo: getValue('github-repo') || null,
            initGit: getChecked('init-git', true),
            createReadme: getChecked('create-readme', true),
            createGitignore: getChecked('create-gitignore', true)
        };

        // Claude Code configuration
        const claudeEnabledEl = document.getElementById('enable-claude');
        const claudeEnabled = claudeEnabledEl ? claudeEnabledEl.checked : true;

        formData.claudeConfig = {
            enabled: claudeEnabled,
            model: claudeEnabled ? getValue('claude-model', 'claude-3-5-sonnet-20241022') : 'claude-3-5-sonnet-20241022',
            temperature: claudeEnabled ? parseFloat(getValue('claude-temperature', '0.7')) : 0.7,
            maxTokens: claudeEnabled ? parseInt(getValue('claude-max-tokens', '4000')) : 4000,
            context: claudeEnabled ? getValue('claude-context') : ''
        };

        // BMAD configuration
        const bmadEnabled = getChecked('enable-bmad', false);
        formData.bmadConfig = {
            enabled: bmadEnabled,
            workflow: bmadEnabled ? getValue('bmad-workflow', 'agile') : 'agile',
            agents: bmadEnabled ? Array.from(document.querySelectorAll('input[name="bmadAgents"]:checked')).map(cb => cb.value) : ['dev']
        };

        return formData;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // BMAD Quick Start functionality
    setupBmadQuickStart() {
        // BMAD template definitions
        this.bmadTemplates = {
            'startup-mvp': {
                name: 'Startup MVP',
                description: 'Rapid prototype development with lean approach',
                agents: ['dev', 'design', 'product'],
                workflow: 'lean',
                features: ['React/Vue Frontend', 'Node.js Backend', 'User Authentication', 'Basic Analytics'],
                timeline: '2-4 weeks'
            },
            'enterprise': {
                name: 'Enterprise Application',
                description: 'Scalable business application with robust architecture',
                agents: ['dev', 'architect', 'security', 'qa'],
                workflow: 'waterfall',
                features: ['Microservices Architecture', 'Database Design', 'Security Framework', 'Testing Suite'],
                timeline: '8-12 weeks'
            },
            'agile-team': {
                name: 'Agile Development Team',
                description: 'Collaborative development with sprint methodology',
                agents: ['dev', 'scrum-master', 'product-owner', 'qa'],
                workflow: 'agile',
                features: ['Sprint Planning', 'Continuous Integration', 'Code Reviews', 'Daily Standups'],
                timeline: '6-8 weeks'
            },
            'data-science': {
                name: 'Data Science Project',
                description: 'ML/AI project with data analysis and modeling',
                agents: ['data-scientist', 'ml-engineer', 'dev'],
                workflow: 'experimental',
                features: ['Data Pipeline', 'Model Training', 'API Development', 'Visualization Dashboard'],
                timeline: '4-6 weeks'
            },
            'maintenance': {
                name: 'Maintenance & Support',
                description: 'Bug fixes and feature enhancements for existing projects',
                agents: ['dev', 'support', 'qa'],
                workflow: 'support',
                features: ['Bug Tracking', 'Performance Monitoring', 'Code Refactoring', 'Documentation'],
                timeline: 'Ongoing'
            },
            'custom': {
                name: 'Custom Setup',
                description: 'Customize your own BMAD workflow and agents',
                agents: ['dev'],
                workflow: 'custom',
                features: ['Custom Configuration', 'Agent Selection', 'Workflow Design'],
                timeline: 'Variable'
            }
        };

        // Template selection event handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('bmad-template-card')) {
                this.selectBmadTemplate(e.target.dataset.template);
            }
        });

        // BMAD Quick Start form handlers
        const quickStartForm = document.getElementById('bmad-quickstart-form');
        if (quickStartForm) {
            quickStartForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createBmadProject();
            });
        }

        // Close modal handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('close-modal')) {
                this.closeBmadQuickStartModal();
            }
        });
    }

    openBmadQuickStartModal() {
        const modal = document.getElementById('bmad-quick-start-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.resetBmadQuickStartForm();
        } else {
            console.error('BMAD Quick Start modal not found');
        }
    }

    closeBmadQuickStartModal() {
        const modal = document.getElementById('bmad-quick-start-modal');
        if (modal) {
            modal.style.display = 'none';
            this.resetBmadQuickStartForm();
        }
    }

    resetBmadQuickStartForm() {
        this.selectedTemplate = null;
        document.querySelectorAll('.bmad-template-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('template-preview').style.display = 'none';
        document.getElementById('bmad-quickstart-form').reset();
    }

    selectBmadTemplate(templateId) {
        this.selectedTemplate = templateId;
        const template = this.bmadTemplates[templateId];

        // Update visual selection
        document.querySelectorAll('.bmad-template-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-template="${templateId}"]`).classList.add('selected');

        // Show template preview
        const preview = document.getElementById('template-preview');
        preview.style.display = 'block';
        preview.innerHTML = `
            <div class="preview-content">
                <h4>${template.name}</h4>
                <p class="template-description">${template.description}</p>

                <div class="preview-section">
                    <h5>Agents</h5>
                    <div class="agent-badges">
                        ${template.agents.map(agent => `<span class="agent-badge">${agent}</span>`).join('')}
                    </div>
                </div>

                <div class="preview-section">
                    <h5>Key Features</h5>
                    <ul class="feature-list">
                        ${template.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>

                <div class="preview-section">
                    <h5>Workflow: ${template.workflow}</h5>
                    <h5>Timeline: ${template.timeline}</h5>
                </div>
            </div>
        `;

        // Auto-fill project name if not set
        const projectNameInput = document.getElementById('bmad-project-name');
        if (!projectNameInput.value) {
            projectNameInput.value = `${template.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now().toString().slice(-4)}`;
        }
    }

    async createBmadProject() {
        if (!this.selectedTemplate) {
            this.showNotification('Please select a template first', 'error');
            return;
        }

        const template = this.bmadTemplates[this.selectedTemplate];
        const projectName = document.getElementById('bmad-project-name').value.trim();
        const projectDescription = document.getElementById('bmad-project-description').value.trim();

        if (!projectName) {
            this.showNotification('Please enter a project name', 'error');
            return;
        }

        // Show loading state
        const createBtn = document.querySelector('#bmad-quickstart-form button[type="submit"]');
        const originalText = createBtn.textContent;
        createBtn.textContent = 'Creating...';
        createBtn.disabled = true;

        try {
            const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

            const formData = {
                name: projectName,
                description: projectDescription || `${template.name} project created with BMAD Quick Start`,
                targetFolder: `/Volumes/Extreme SSD/Workspace/${sanitizedName}`,
                template: 'bmad-' + this.selectedTemplate,
                initGit: true,
                createReadme: true,
                createGitignore: true,
                claudeConfig: {
                    enabled: true,
                    model: 'claude-3-5-sonnet-20241022',
                    temperature: 0.7,
                    maxTokens: 4000,
                    context: `This is a ${template.name} project. Focus on ${template.description.toLowerCase()}.`
                },
                bmadConfig: {
                    enabled: true,
                    workflow: template.workflow,
                    agents: template.agents,
                    template: this.selectedTemplate
                }
            };

            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.addActivity(`Created BMAD project: ${projectName}`);
                this.closeBmadQuickStartModal();
                await this.loadProjects();

                // Auto-select the new project
                setTimeout(() => {
                    const selector = document.getElementById('project-selector');
                    selector.value = result.data.id;
                    this.loadProject(result.data.id);
                }, 500);

                this.showNotification('BMAD project created successfully!', 'success');

                // Auto-start BMAD workflow
                setTimeout(() => {
                    this.startBmadWorkflow();
                    this.switchTab('bmad');
                }, 1000);

            } else {
                throw new Error(result.message || 'Failed to create BMAD project');
            }
        } catch (error) {
            console.error('Error creating BMAD project:', error);
            this.showNotification(`Error creating project: ${error.message}`, 'error');
        } finally {
            createBtn.textContent = originalText;
            createBtn.disabled = false;
        }
    }

    async startBmadWorkflow() {
        if (!this.currentProject || !this.currentProject.bmadConfig?.enabled) {
            return;
        }

        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/bmad/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workflow: this.currentProject.bmadConfig.workflow,
                    agents: this.currentProject.bmadConfig.agents,
                    template: this.currentProject.bmadConfig.template
                })
            });

            const result = await response.json();

            if (result.success) {
                this.addActivity('BMAD workflow started successfully');

                // Initialize BMAD agents in the UI
                this.currentProject.bmadConfig.agents.forEach(agentType => {
                    this.addBmadAgent(agentType);
                });

                this.showNotification('BMAD workflow started!', 'success');
            }
        } catch (error) {
            console.error('Error starting BMAD workflow:', error);
            this.showNotification('Failed to start BMAD workflow', 'error');
        }
    }

    // Brainstorming functionality
    setupBrainstorming() {
        this.brainstormStep = 0;
        this.brainstormSteps = ['ideation', 'analysis', 'brief', 'setup'];
        this.selectedCategory = null;
        this.projectAnalysis = {};

        // Category selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag')) {
                this.selectCategory(e.target);
            }
        });

        // Approach card selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('approach-card') || e.target.closest('.approach-card')) {
                const card = e.target.classList.contains('approach-card') ? e.target : e.target.closest('.approach-card');
                this.selectApproach(card);
            }
        });
    }

    openBrainstormModal() {
        const modal = document.getElementById('brainstorm-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.resetBrainstormForm();
        } else {
            console.error('Brainstorm modal not found');
        }
    }

    closeBrainstormModal() {
        document.getElementById('brainstorm-modal').style.display = 'none';
        this.resetBrainstormForm();
    }

    resetBrainstormForm() {
        this.brainstormStep = 0;
        this.selectedCategory = null;
        this.projectAnalysis = {};

        // Reset form
        document.getElementById('project-idea').value = '';
        document.querySelectorAll('.tag').forEach(tag => tag.classList.remove('selected'));
        document.querySelectorAll('.approach-card').forEach(card => card.classList.remove('selected'));

        // Reset step display
        this.updateBrainstormStepDisplay();
    }

    fillIdeaPrompt(prompt) {
        document.getElementById('project-idea').value = prompt;

        // Auto-select category based on prompt
        if (prompt.includes('platform') || prompt.includes('social')) {
            this.selectCategoryByName('web-app');
        } else if (prompt.includes('AI') || prompt.includes('assistant')) {
            this.selectCategoryByName('automation');
        } else if (prompt.includes('marketplace') || prompt.includes('freelance')) {
            this.selectCategoryByName('web-app');
        } else if (prompt.includes('fitness') || prompt.includes('tracking')) {
            this.selectCategoryByName('mobile-app');
        } else if (prompt.includes('sustainable') || prompt.includes('carbon')) {
            this.selectCategoryByName('mobile-app');
        }
    }

    selectCategory(tagElement) {
        // Remove previous selection
        document.querySelectorAll('.tag').forEach(tag => tag.classList.remove('selected'));

        // Select new category
        tagElement.classList.add('selected');
        this.selectedCategory = tagElement.dataset.category;
    }

    selectCategoryByName(categoryName) {
        const tagElement = document.querySelector(`[data-category="${categoryName}"]`);
        if (tagElement) {
            this.selectCategory(tagElement);
        }
    }

    selectApproach(cardElement) {
        // Remove previous selection
        document.querySelectorAll('.approach-card').forEach(card => card.classList.remove('selected'));

        // Select new approach
        cardElement.classList.add('selected');
        this.selectedApproach = cardElement.dataset.approach;
    }

    nextBrainstormStep() {
        if (this.brainstormStep === 0) {
            // Validate ideation step
            const idea = document.getElementById('project-idea').value.trim();
            if (!idea) {
                this.showNotification('Please describe your project idea', 'error');
                return;
            }

            // Move to analysis step and generate analysis
            this.brainstormStep++;
            this.updateBrainstormStepDisplay();
            this.generateProjectAnalysis(idea);

        } else if (this.brainstormStep === 1) {
            // Move to brief step and generate brief
            this.brainstormStep++;
            this.updateBrainstormStepDisplay();
            this.generateProjectBrief();

        } else if (this.brainstormStep === 2) {
            // Move to setup step
            this.brainstormStep++;
            this.updateBrainstormStepDisplay();
            this.populateSetupSummary();
        }
    }

    prevBrainstormStep() {
        if (this.brainstormStep > 0) {
            this.brainstormStep--;
            this.updateBrainstormStepDisplay();
        }
    }

    updateBrainstormStepDisplay() {
        // Update progress steps
        document.querySelectorAll('.brainstorm-progress .step').forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index < this.brainstormStep) {
                step.classList.add('completed');
            } else if (index === this.brainstormStep) {
                step.classList.add('active');
            }
        });

        // Show/hide step sections
        document.querySelectorAll('.step-section').forEach(section => {
            section.classList.remove('active');
        });

        const currentStepId = this.brainstormSteps[this.brainstormStep];
        document.getElementById(`step-${currentStepId}`).classList.add('active');

        // Update button states
        const prevBtn = document.getElementById('prev-brainstorm-step');
        const nextBtn = document.getElementById('next-brainstorm-step');
        const createBtn = document.getElementById('create-from-brainstorm');

        prevBtn.style.display = this.brainstormStep > 0 ? 'inline-block' : 'none';

        if (this.brainstormStep === 0) {
            nextBtn.textContent = 'Analyze Idea';
            nextBtn.style.display = 'inline-block';
            createBtn.style.display = 'none';
        } else if (this.brainstormStep === 1) {
            nextBtn.textContent = 'Generate Brief';
            nextBtn.style.display = 'inline-block';
            createBtn.style.display = 'none';
        } else if (this.brainstormStep === 2) {
            nextBtn.textContent = 'Setup Project';
            nextBtn.style.display = 'inline-block';
            createBtn.style.display = 'none';
        } else if (this.brainstormStep === 3) {
            nextBtn.style.display = 'none';
            createBtn.style.display = 'inline-block';
        }
    }

    async generateProjectAnalysis(idea) {
        // Show loading state with more detailed progress
        this.showAnalysisProgress();

        try {
            // Stage 1: Concept Enhancement
            await this.runAnalysisStage('Enhancing project concept...', 800);
            const enhancedConcept = this.generateEnhancedConcept(idea);
            document.getElementById('enhanced-concept').innerHTML = `<p>${enhancedConcept}</p>`;

            // Stage 2: Market Analysis
            await this.runAnalysisStage('Analyzing market opportunities...', 600);
            const marketAnalysis = this.generateMarketAnalysis(idea);

            // Stage 3: Target Audience Identification
            await this.runAnalysisStage('Identifying target audience...', 700);
            const targetAudience = this.generateTargetAudience(idea);
            document.getElementById('target-audience').innerHTML = `<p>${targetAudience}</p>`;

            // Stage 4: Smart Feature Generation
            await this.runAnalysisStage('Generating intelligent feature suggestions...', 900);
            const smartFeatures = this.generateSmartFeatures(idea, enhancedConcept);
            document.getElementById('features-list').innerHTML = smartFeatures.map(feature => `<li>${feature}</li>`).join('');

            // Stage 5: Tech Stack Optimization
            await this.runAnalysisStage('Optimizing technology stack...', 800);
            const techStack = this.generateOptimizedTechStack(idea, smartFeatures);
            document.getElementById('frontend-tech').textContent = techStack.frontend;
            document.getElementById('backend-tech').textContent = techStack.backend;
            document.getElementById('database-tech').textContent = techStack.database;

            // Stage 6: Risk Assessment & Recommendations
            await this.runAnalysisStage('Performing risk assessment...', 600);
            const riskAssessment = this.generateRiskAssessment(idea, smartFeatures);

            // Stage 7: Competitive Analysis
            await this.runAnalysisStage('Analyzing competitive landscape...', 700);
            const competitiveAnalysis = this.generateCompetitiveAnalysis(idea);

            // Stage 8: Success Metrics & KPIs
            await this.runAnalysisStage('Defining success metrics...', 500);
            const successMetrics = this.generateSuccessMetrics(idea);

            // Compile comprehensive analysis
            this.projectAnalysis = {
                enhancedConcept,
                targetAudience,
                keyFeatures: smartFeatures,
                techStack,
                marketAnalysis,
                riskAssessment,
                competitiveAnalysis,
                successMetrics,
                recommendations: this.generateAIRecommendations(idea, smartFeatures, techStack)
            };

            // Show AI insights panel
            this.displayAIInsights();

        } catch (error) {
            this.showNotification('Error generating analysis', 'error');
        }
    }

    async runAnalysisStage(message, duration) {
        document.getElementById('analysis-progress-text').textContent = message;
        await new Promise(resolve => setTimeout(resolve, duration));
    }

    showAnalysisProgress() {
        const progressHTML = `
            <div class="ai-analysis-progress">
                <div class="progress-header">
                    <h4>🧠 AI Project Analysis</h4>
                    <div class="analysis-spinner"></div>
                </div>
                <div class="progress-status">
                    <p id="analysis-progress-text">Initializing AI analysis...</p>
                </div>
            </div>
        `;

        document.getElementById('enhanced-concept').innerHTML = progressHTML;
        document.getElementById('target-audience').innerHTML = '<p>⏳ Awaiting analysis results...</p>';
        document.getElementById('features-list').innerHTML = '<li>⏳ Generating features...</li>';
    }

    generateMarketAnalysis(idea) {
        const keywords = idea.toLowerCase().split(' ');
        const marketSize = this.estimateMarketSize(keywords);
        const trends = this.identifyMarketTrends(keywords);
        const opportunities = this.identifyOpportunities(keywords);

        return {
            marketSize,
            trends,
            opportunities,
            demandScore: Math.floor(Math.random() * 30) + 70, // 70-100 score
            competitionLevel: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)]
        };
    }

    estimateMarketSize(keywords) {
        const marketIndicators = {
            'e-commerce': '$6.2 trillion global market',
            'social': '$159 billion social media market',
            'fitness': '$96 billion fitness industry',
            'education': '$350 billion EdTech market',
            'healthcare': '$2.4 trillion healthcare market',
            'finance': '$1.3 trillion FinTech market'
        };

        for (const keyword of keywords) {
            for (const [key, value] of Object.entries(marketIndicators)) {
                if (keyword.includes(key)) return value;
            }
        }

        return '$50-500 billion addressable market';
    }

    identifyMarketTrends(keywords) {
        const trendMap = {
            'mobile': ['Mobile-first design', 'Progressive Web Apps', 'Cross-platform development'],
            'ai': ['AI integration', 'Machine learning automation', 'Personalization'],
            'social': ['Social commerce', 'Community building', 'User-generated content'],
            'health': ['Digital wellness', 'Telemedicine', 'Wearable integration'],
            'finance': ['Cryptocurrency adoption', 'Digital payments', 'Financial inclusion']
        };

        const trends = [];
        for (const keyword of keywords) {
            for (const [key, values] of Object.entries(trendMap)) {
                if (keyword.includes(key)) {
                    trends.push(...values);
                }
            }
        }

        return trends.length > 0 ? trends.slice(0, 3) : ['Digital transformation', 'User experience focus', 'Cloud-first architecture'];
    }

    identifyOpportunities(keywords) {
        return [
            'Underserved market segments exist',
            'Technology gaps in current solutions',
            'Growing demand for mobile solutions',
            'Opportunity for AI/ML integration',
            'Potential for subscription model'
        ].slice(0, 3);
    }

    generateSmartFeatures(idea, concept) {
        const baseFeatures = this.generateKeyFeatures(idea);
        const aiEnhancedFeatures = this.addAIEnhancements(baseFeatures, idea);
        const prioritizedFeatures = this.prioritizeFeatures(aiEnhancedFeatures, concept);

        return prioritizedFeatures;
    }

    addAIEnhancements(features, idea) {
        const aiKeywords = ['smart', 'intelligent', 'automated', 'personalized', 'predictive'];
        const enhancedFeatures = [...features];

        // Add AI-powered features based on context
        if (idea.toLowerCase().includes('user') || idea.toLowerCase().includes('people')) {
            enhancedFeatures.push('AI-powered user recommendations');
            enhancedFeatures.push('Personalized user experience');
        }

        if (idea.toLowerCase().includes('data') || idea.toLowerCase().includes('analytics')) {
            enhancedFeatures.push('Intelligent data insights');
            enhancedFeatures.push('Predictive analytics dashboard');
        }

        if (idea.toLowerCase().includes('chat') || idea.toLowerCase().includes('communication')) {
            enhancedFeatures.push('AI chatbot integration');
            enhancedFeatures.push('Smart conversation routing');
        }

        // Add automation features
        enhancedFeatures.push('Automated workflow management');
        enhancedFeatures.push('Smart notification system');

        return enhancedFeatures;
    }

    prioritizeFeatures(features, concept) {
        // Use AI-like prioritization based on impact and effort
        const prioritizedFeatures = features.map(feature => ({
            name: feature,
            priority: this.calculateFeaturePriority(feature, concept),
            impact: this.estimateBusinessImpact(feature),
            effort: this.estimateDevelopmentEffort(feature)
        }));

        // Sort by priority score and return top features
        prioritizedFeatures.sort((a, b) => b.priority - a.priority);
        return prioritizedFeatures.slice(0, 8).map(f => f.name);
    }

    calculateFeaturePriority(feature, concept) {
        let score = 50; // Base score

        // Core functionality gets higher priority
        if (feature.toLowerCase().includes('auth') || feature.toLowerCase().includes('login')) score += 30;
        if (feature.toLowerCase().includes('dashboard') || feature.toLowerCase().includes('main')) score += 25;
        if (feature.toLowerCase().includes('user') || feature.toLowerCase().includes('profile')) score += 20;

        // AI features get bonus in modern context
        if (feature.toLowerCase().includes('ai') || feature.toLowerCase().includes('smart')) score += 15;
        if (feature.toLowerCase().includes('automated') || feature.toLowerCase().includes('intelligent')) score += 10;

        // Integration features are valuable
        if (feature.toLowerCase().includes('integration') || feature.toLowerCase().includes('api')) score += 12;

        return Math.min(score, 100);
    }

    estimateBusinessImpact(feature) {
        const highImpactKeywords = ['revenue', 'user', 'core', 'main', 'primary'];
        const mediumImpactKeywords = ['notification', 'integration', 'analytics'];

        const featureLower = feature.toLowerCase();
        if (highImpactKeywords.some(keyword => featureLower.includes(keyword))) {
            return 'High';
        } else if (mediumImpactKeywords.some(keyword => featureLower.includes(keyword))) {
            return 'Medium';
        }
        return 'Low';
    }

    estimateDevelopmentEffort(feature) {
        const highEffortKeywords = ['ai', 'machine learning', 'real-time', 'integration', 'analytics'];
        const mediumEffortKeywords = ['dashboard', 'notification', 'search', 'chat'];

        const featureLower = feature.toLowerCase();
        if (highEffortKeywords.some(keyword => featureLower.includes(keyword))) {
            return 'High';
        } else if (mediumEffortKeywords.some(keyword => featureLower.includes(keyword))) {
            return 'Medium';
        }
        return 'Low';
    }

    generateOptimizedTechStack(idea, features) {
        const baseStack = this.generateTechStack(idea);

        // Optimize based on features and requirements
        const optimizedStack = { ...baseStack };

        // AI/ML features require specific tech
        const hasAIFeatures = features.some(f => f.toLowerCase().includes('ai') || f.toLowerCase().includes('smart'));
        if (hasAIFeatures) {
            optimizedStack.backend += ', Python (AI/ML)';
            optimizedStack.additional = 'TensorFlow, OpenAI API';
        }

        // Real-time features need WebSocket support
        const hasRealTime = features.some(f => f.toLowerCase().includes('real-time') || f.toLowerCase().includes('chat'));
        if (hasRealTime) {
            optimizedStack.backend += ', Socket.io';
        }

        // Mobile features require specific frameworks
        const hasMobile = features.some(f => f.toLowerCase().includes('mobile') || f.toLowerCase().includes('app'));
        if (hasMobile) {
            optimizedStack.frontend += ', React Native';
        }

        return optimizedStack;
    }

    generateRiskAssessment(idea, features) {
        return {
            technical: this.assessTechnicalRisks(features),
            market: this.assessMarketRisks(idea),
            operational: this.assessOperationalRisks(features),
            mitigation: this.generateMitigationStrategies(features)
        };
    }

    assessTechnicalRisks(features) {
        const risks = [];
        if (features.some(f => f.toLowerCase().includes('ai'))) {
            risks.push('AI model complexity and training requirements');
        }
        if (features.some(f => f.toLowerCase().includes('real-time'))) {
            risks.push('Scalability challenges with real-time features');
        }
        if (features.some(f => f.toLowerCase().includes('integration'))) {
            risks.push('Third-party API dependencies and reliability');
        }

        return risks.length > 0 ? risks : ['Standard development complexity', 'Cross-browser compatibility'];
    }

    assessMarketRisks(idea) {
        return [
            'Competitive market with established players',
            'User adoption and retention challenges',
            'Changing market demands and trends'
        ];
    }

    assessOperationalRisks(features) {
        return [
            'Team scaling and talent acquisition',
            'Infrastructure costs and scaling',
            'Regulatory compliance requirements'
        ];
    }

    generateMitigationStrategies(features) {
        return [
            'Implement MVP approach with core features first',
            'Establish robust testing and quality assurance',
            'Plan for iterative development and user feedback',
            'Invest in monitoring and analytics from day one'
        ];
    }

    generateCompetitiveAnalysis(idea) {
        return {
            directCompetitors: this.identifyCompetitors(idea),
            competitiveAdvantages: this.identifyAdvantages(idea),
            marketPosition: this.suggestMarketPosition(idea)
        };
    }

    identifyCompetitors(idea) {
        // Simulate competitor analysis based on idea keywords
        const keywords = idea.toLowerCase();
        if (keywords.includes('social')) return ['Facebook', 'Instagram', 'TikTok'];
        if (keywords.includes('e-commerce')) return ['Amazon', 'Shopify', 'eBay'];
        if (keywords.includes('fitness')) return ['MyFitnessPal', 'Nike Training', 'Strava'];
        if (keywords.includes('education')) return ['Coursera', 'Udemy', 'Khan Academy'];

        return ['Industry leaders', 'Startup competitors', 'Enterprise solutions'];
    }

    identifyAdvantages(idea) {
        return [
            'Modern technology stack and architecture',
            'Focus on user experience and design',
            'Agile development and rapid iteration',
            'AI-powered features and personalization'
        ];
    }

    suggestMarketPosition(idea) {
        return 'Position as innovative, user-focused solution with modern technology and superior user experience';
    }

    generateAIRecommendations(idea, features, techStack) {
        return [
            {
                category: 'Development Approach',
                recommendation: 'Start with MVP focusing on core features, then iterate based on user feedback',
                rationale: 'Reduces time to market and allows for validated learning'
            },
            {
                category: 'Technology',
                recommendation: `Leverage ${techStack.frontend.split(',')[0]} for rapid prototyping`,
                rationale: 'Provides excellent developer experience and community support'
            },
            {
                category: 'User Experience',
                recommendation: 'Implement progressive web app (PWA) capabilities',
                rationale: 'Enhances mobile experience and allows for offline functionality'
            },
            {
                category: 'Growth Strategy',
                recommendation: 'Build in analytics and A/B testing from the start',
                rationale: 'Enables data-driven decision making and optimization'
            }
        ];
    }

    displayAIInsights() {
        const insightsPanel = document.createElement('div');
        insightsPanel.className = 'ai-insights-panel';
        insightsPanel.innerHTML = `
            <div class="insights-header">
                <h4>🤖 AI Strategic Insights</h4>
                <p>Data-driven recommendations for your project</p>
            </div>
            <div class="insights-content">
                <div class="insight-section">
                    <h5>📊 Market Opportunity</h5>
                    <div class="market-score">
                        <div class="score-circle">
                            <span class="score-number">${this.projectAnalysis.marketAnalysis.demandScore}</span>
                            <span class="score-label">Demand Score</span>
                        </div>
                        <div class="market-details">
                            <p><strong>Market Size:</strong> ${this.projectAnalysis.marketAnalysis.marketSize}</p>
                            <p><strong>Competition:</strong> ${this.projectAnalysis.marketAnalysis.competitionLevel}</p>
                        </div>
                    </div>
                </div>
                <div class="insight-section">
                    <h5>🎯 Key Recommendations</h5>
                    <div class="recommendations-list">
                        ${this.projectAnalysis.recommendations.map(rec => `
                            <div class="recommendation-item">
                                <strong>${rec.category}:</strong> ${rec.recommendation}
                                <small>${rec.rationale}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="insight-section">
                    <h5>⚠️ Risk Mitigation</h5>
                    <div class="risk-items">
                        ${this.projectAnalysis.riskAssessment.mitigation.map(strategy => `
                            <div class="risk-item">• ${strategy}</div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Insert insights panel after analysis results
        const analysisContainer = document.querySelector('.step-analysis');
        const existingInsights = analysisContainer.querySelector('.ai-insights-panel');
        if (existingInsights) {
            existingInsights.remove();
        }
        analysisContainer.appendChild(insightsPanel);
    }

    generateEnhancedConcept(idea) {
        // Simple AI-like enhancement based on keywords
        const enhancements = {
            'fitness': 'A comprehensive fitness and wellness platform with personalized workout plans, nutrition tracking, and social challenges to motivate users toward their health goals.',
            'social': 'A community-driven platform that connects like-minded individuals through shared interests, local events, and collaborative projects.',
            'productivity': 'An intelligent productivity suite that combines task management, time tracking, and AI-powered insights to help professionals optimize their workflow.',
            'marketplace': 'A modern marketplace platform with advanced filtering, secure payment processing, and integrated communication tools for seamless transactions.',
            'sustainability': 'An environmental impact tracking application that gamifies sustainable living through challenges, rewards, and community engagement.',
            'default': `An innovative digital solution that leverages modern technology to address real-world challenges with an intuitive user experience and scalable architecture.`
        };

        for (const [keyword, enhancement] of Object.entries(enhancements)) {
            if (idea.toLowerCase().includes(keyword)) {
                return enhancement;
            }
        }
        return enhancements.default;
    }

    generateTargetAudience(idea) {
        const audiences = {
            'fitness': 'Health-conscious individuals aged 25-45, including fitness enthusiasts, busy professionals seeking structured workout routines, and people beginning their wellness journey.',
            'social': 'Community-minded individuals aged 18-55 who value local connections, social activism, and collaborative problem-solving.',
            'productivity': 'Remote workers, freelancers, and small business owners aged 25-50 who seek to optimize their time management and increase efficiency.',
            'marketplace': 'Small business owners, freelancers, and consumers aged 18-65 looking for specialized services or unique products.',
            'sustainability': 'Environmentally conscious individuals aged 20-50 who want to track and reduce their carbon footprint while engaging with like-minded communities.',
            'default': 'Tech-savvy users aged 18-65 who value innovation, efficiency, and seamless digital experiences.'
        };

        for (const [keyword, audience] of Object.entries(audiences)) {
            if (idea.toLowerCase().includes(keyword)) {
                return audience;
            }
        }
        return audiences.default;
    }

    generateKeyFeatures(idea) {
        const featureSets = {
            'fitness': [
                'Personalized workout plan generator',
                'Progress tracking and analytics',
                'Social challenges and leaderboards',
                'Nutrition tracking and meal planning',
                'Integration with wearable devices',
                'Video exercise library',
                'Community forums and support groups'
            ],
            'social': [
                'User profile creation and customization',
                'Interest-based group formation',
                'Event creation and management',
                'Real-time messaging and forums',
                'Location-based community discovery',
                'Resource sharing marketplace',
                'Volunteer opportunity matching'
            ],
            'productivity': [
                'AI-powered task prioritization',
                'Time tracking and analytics',
                'Project collaboration tools',
                'Calendar integration',
                'Automated reporting dashboard',
                'Goal setting and milestone tracking',
                'Integration with popular productivity tools'
            ],
            'marketplace': [
                'Advanced search and filtering',
                'Secure payment processing',
                'User rating and review system',
                'Integrated messaging platform',
                'Order tracking and management',
                'Seller dashboard and analytics',
                'Mobile-responsive design'
            ],
            'sustainability': [
                'Carbon footprint calculator',
                'Sustainable habit tracking',
                'Eco-friendly product recommendations',
                'Community challenges and rewards',
                'Educational content library',
                'Local green business directory',
                'Impact visualization and reporting'
            ],
            'default': [
                'User authentication and profiles',
                'Responsive web design',
                'Real-time data synchronization',
                'Search and filtering capabilities',
                'Analytics dashboard',
                'Mobile application',
                'API integration capabilities'
            ]
        };

        for (const [keyword, features] of Object.entries(featureSets)) {
            if (idea.toLowerCase().includes(keyword)) {
                return features;
            }
        }
        return featureSets.default;
    }

    generateTechStack(idea) {
        const category = this.selectedCategory || 'web-app';

        const stacks = {
            'web-app': {
                frontend: 'React, TypeScript, Tailwind CSS',
                backend: 'Node.js, Express, PostgreSQL',
                database: 'PostgreSQL with Redis caching'
            },
            'mobile-app': {
                frontend: 'React Native, TypeScript',
                backend: 'Node.js, Express, MongoDB',
                database: 'MongoDB with real-time sync'
            },
            'api': {
                frontend: 'React Admin Dashboard',
                backend: 'Node.js, Express, GraphQL',
                database: 'PostgreSQL with GraphQL'
            },
            'data-science': {
                frontend: 'React, D3.js, Python Dash',
                backend: 'Python, FastAPI, ML Libraries',
                database: 'PostgreSQL, InfluxDB'
            },
            'automation': {
                frontend: 'React, TypeScript',
                backend: 'Python, FastAPI, Celery',
                database: 'PostgreSQL, Redis'
            },
            'default': {
                frontend: 'React, TypeScript, CSS Modules',
                backend: 'Node.js, Express, REST API',
                database: 'PostgreSQL with connection pooling'
            }
        };

        return stacks[category] || stacks.default;
    }

    async generateProjectBrief() {
        const idea = document.getElementById('project-idea').value.trim();
        const category = document.getElementById('project-category').value;

        // Enhanced project brief generation with comprehensive sections
        const brief = this.generateComprehensiveProjectBrief(idea, category, this.projectAnalysis);

        // Update all brief sections
        document.getElementById('brief-overview').innerHTML = brief.overview;
        document.getElementById('brief-objectives').innerHTML = brief.objectives.map(obj => `<li>${obj}</li>`).join('');
        document.getElementById('brief-features').innerHTML = brief.features.map(feature =>
            `<div class="feature-item">
                <div class="feature-header">
                    <strong>${feature.name}</strong>
                    <span class="feature-priority priority-${feature.priority.toLowerCase()}">${feature.priority}</span>
                </div>
                <div class="feature-details">
                    <div class="feature-effort">${feature.effort}</div>
                    ${feature.dependencies.length > 0 ? `<div class="feature-deps">Dependencies: ${feature.dependencies.join(', ')}</div>` : ''}
                </div>
            </div>`
        ).join('');
        document.getElementById('brief-tech-requirements').innerHTML = brief.technicalRequirements;

        // Add download functionality for the brief
        this.generateBriefDocument(brief);
    }

    generateComprehensiveProjectBrief(idea, category, analysis) {
        // Generate detailed overview with business context
        const overview = this.generateDetailedOverview(idea, category, analysis);

        // Generate SMART objectives based on project type
        const objectives = this.generateSmartObjectives(category, analysis);

        // Enhanced feature breakdown with priorities
        const features = this.generateFeatureBreakdown(analysis.keyFeatures, category);

        // Comprehensive technical requirements
        const technicalRequirements = this.generateTechnicalRequirements(analysis.techStack, category);

        return {
            overview,
            objectives,
            features,
            technicalRequirements,
            timeline: this.generateProjectTimeline(category, features.length),
            budget: this.generateBudgetEstimate(category, features.length),
            risks: this.generateRiskAssessment(category),
            success_metrics: this.generateSuccessMetrics(category)
        };
    }

    generateDetailedOverview(idea, category, analysis) {
        const marketContext = this.getMarketContext(category);
        const valueProposition = this.generateValueProposition(analysis.enhancedConcept, analysis.targetAudience);

        return `
            <div class="detailed-overview">
                <div class="overview-section">
                    <h4>Project Vision</h4>
                    <p>${analysis.enhancedConcept}</p>
                </div>
                <div class="overview-section">
                    <h4>Market Context</h4>
                    <p>${marketContext}</p>
                </div>
                <div class="overview-section">
                    <h4>Value Proposition</h4>
                    <p>${valueProposition}</p>
                </div>
                <div class="overview-section">
                    <h4>Target Audience</h4>
                    <p>${analysis.targetAudience}</p>
                </div>
            </div>
        `;
    }

    generateSmartObjectives(category, analysis) {
        const baseObjectives = {
            'web-app': [
                'Achieve 95% user satisfaction rating within 6 months of launch',
                'Reach 10,000 monthly active users by end of year 1',
                'Maintain 99.5% uptime with average page load time under 2 seconds',
                'Implement full accessibility compliance (WCAG 2.1 AA standard)'
            ],
            'mobile-app': [
                'Achieve 4.5+ star rating on app stores within 3 months',
                'Reach 50,000 downloads in the first 6 months',
                'Maintain app crash rate below 0.1%',
                'Support offline functionality for core features'
            ],
            'api': [
                'Handle 1000+ requests per second with 99.9% uptime',
                'Achieve sub-100ms response time for 95% of API calls',
                'Implement comprehensive API documentation and testing',
                'Establish rate limiting and security best practices'
            ],
            'data-science': [
                'Achieve model accuracy of 90%+ on validation dataset',
                'Process real-time data with latency under 100ms',
                'Implement automated model retraining pipeline',
                'Create comprehensive data visualization dashboard'
            ]
        };

        return baseObjectives[category] || [
            'Deliver high-quality, maintainable software solution',
            'Achieve project completion within specified timeline and budget',
            'Implement comprehensive testing with 90%+ code coverage',
            'Establish monitoring and alerting for production environment'
        ];
    }

    generateFeatureBreakdown(keyFeatures, category) {
        return keyFeatures.map(feature => {
            const priority = this.assignFeaturePriority(feature, category);
            const effort = this.estimateFeatureEffort(feature);
            const dependencies = this.identifyFeatureDependencies(feature, keyFeatures);

            return {
                name: feature,
                priority,
                effort,
                dependencies,
                description: this.expandFeatureDescription(feature, category)
            };
        });
    }

    generateTechnicalRequirements(techStack, category) {
        const performanceReqs = this.getPerformanceRequirements(category);
        const securityReqs = this.getSecurityRequirements(category);
        const scalabilityReqs = this.getScalabilityRequirements(category);

        return `
            <div class="tech-requirements">
                <div class="tech-section">
                    <h4>Technology Stack</h4>
                    <div class="tech-stack">
                        <div><strong>Frontend:</strong> ${techStack.frontend}</div>
                        <div><strong>Backend:</strong> ${techStack.backend}</div>
                        <div><strong>Database:</strong> ${techStack.database}</div>
                        <div><strong>Cloud Platform:</strong> ${this.recommendCloudPlatform(category)}</div>
                    </div>
                </div>
                <div class="tech-section">
                    <h4>Performance Requirements</h4>
                    <ul>${performanceReqs.map(req => `<li>${req}</li>`).join('')}</ul>
                </div>
                <div class="tech-section">
                    <h4>Security Requirements</h4>
                    <ul>${securityReqs.map(req => `<li>${req}</li>`).join('')}</ul>
                </div>
                <div class="tech-section">
                    <h4>Scalability Requirements</h4>
                    <ul>${scalabilityReqs.map(req => `<li>${req}</li>`).join('')}</ul>
                </div>
            </div>
        `;
    }

    getMarketContext(category) {
        const contexts = {
            'web-app': 'The web application market continues to grow with increasing demand for responsive, user-friendly interfaces. Modern web apps compete on speed, accessibility, and seamless user experience.',
            'mobile-app': 'Mobile applications dominate user engagement with over 90% of mobile time spent in apps. Success depends on intuitive design, performance optimization, and platform-specific features.',
            'api': 'API-first development drives modern software architecture, enabling microservices, third-party integrations, and scalable backend systems. RESTful and GraphQL APIs are industry standards.',
            'data-science': 'Data-driven decision making is critical for business success. Machine learning and analytics platforms require robust data pipelines, model deployment, and real-time processing capabilities.'
        };

        return contexts[category] || 'This project operates in a competitive technology landscape requiring innovative solutions and excellent execution.';
    }

    generateValueProposition(concept, audience) {
        return `This solution addresses key pain points for ${audience} by providing ${concept.toLowerCase()}. The unique value comes from combining ease of use with powerful functionality, delivered through modern technology and user-centered design.`;
    }

    assignFeaturePriority(feature, category) {
        // Simple priority assignment based on keywords and category
        const highPriorityKeywords = ['auth', 'login', 'security', 'core', 'main', 'primary'];
        const isHighPriority = highPriorityKeywords.some(keyword =>
            feature.toLowerCase().includes(keyword)
        );

        return isHighPriority ? 'High' : Math.random() > 0.5 ? 'Medium' : 'Low';
    }

    estimateFeatureEffort(feature) {
        // Simple effort estimation based on feature complexity indicators
        const complexKeywords = ['integration', 'dashboard', 'analytics', 'real-time', 'ai', 'machine learning'];
        const isComplex = complexKeywords.some(keyword =>
            feature.toLowerCase().includes(keyword)
        );

        if (isComplex) return 'High (8-13 story points)';
        return Math.random() > 0.5 ? 'Medium (3-5 story points)' : 'Low (1-2 story points)';
    }

    identifyFeatureDependencies(feature, allFeatures) {
        // Simple dependency identification
        if (feature.toLowerCase().includes('dashboard')) return ['User Authentication', 'Data Collection'];
        if (feature.toLowerCase().includes('notification')) return ['User Management'];
        return [];
    }

    expandFeatureDescription(feature, category) {
        return `Detailed implementation of ${feature} tailored for ${category} requirements, including user interface design, backend logic, and integration testing.`;
    }

    getPerformanceRequirements(category) {
        const requirements = {
            'web-app': [
                'Page load time under 3 seconds on 3G connection',
                'First Contentful Paint under 1.5 seconds',
                'Support for 1000+ concurrent users',
                'Lighthouse performance score above 90'
            ],
            'mobile-app': [
                'App startup time under 2 seconds',
                'Smooth 60fps animations and transitions',
                'Memory usage under 100MB for core functionality',
                'Battery usage optimization for background tasks'
            ],
            'api': [
                'Response time under 200ms for 95% of requests',
                'Support for 10,000+ requests per minute',
                'Rate limiting with graceful degradation',
                'Horizontal scaling capability'
            ]
        };

        return requirements[category] || [
            'System response time under 2 seconds',
            'Support for expected user load',
            'Optimized resource utilization',
            'Performance monitoring and alerting'
        ];
    }

    getSecurityRequirements(category) {
        return [
            'HTTPS encryption for all data transmission',
            'Input validation and sanitization',
            'Authentication and authorization controls',
            'Regular security audits and vulnerability assessments',
            'Data privacy compliance (GDPR, CCPA)',
            'Secure API endpoints with rate limiting'
        ];
    }

    getScalabilityRequirements(category) {
        return [
            'Horizontal scaling architecture design',
            'Database optimization and indexing',
            'Caching strategy implementation',
            'Load balancing and distribution',
            'Microservices architecture consideration',
            'Auto-scaling policies for cloud deployment'
        ];
    }

    recommendCloudPlatform(category) {
        const platforms = ['AWS', 'Google Cloud Platform', 'Microsoft Azure', 'Vercel', 'Netlify'];
        return platforms[Math.floor(Math.random() * platforms.length)];
    }

    generateProjectTimeline(category, featureCount) {
        const baseWeeks = {
            'web-app': 12,
            'mobile-app': 16,
            'api': 8,
            'data-science': 14
        };

        const estimatedWeeks = (baseWeeks[category] || 10) + Math.floor(featureCount / 2);
        return {
            total: `${estimatedWeeks} weeks`,
            phases: [
                { name: 'Planning & Design', duration: '2-3 weeks' },
                { name: 'Development Phase 1', duration: `${Math.floor(estimatedWeeks * 0.4)} weeks` },
                { name: 'Development Phase 2', duration: `${Math.floor(estimatedWeeks * 0.3)} weeks` },
                { name: 'Testing & QA', duration: `${Math.floor(estimatedWeeks * 0.2)} weeks` },
                { name: 'Deployment & Launch', duration: '1-2 weeks' }
            ]
        };
    }

    generateBudgetEstimate(category, featureCount) {
        const baseCost = {
            'web-app': 25000,
            'mobile-app': 40000,
            'api': 15000,
            'data-science': 35000
        };

        const estimated = (baseCost[category] || 20000) + (featureCount * 2000);
        return {
            estimated: `$${estimated.toLocaleString()}`,
            breakdown: [
                { category: 'Development', percentage: 60 },
                { category: 'Design & UX', percentage: 20 },
                { category: 'Testing & QA', percentage: 15 },
                { category: 'Project Management', percentage: 5 }
            ]
        };
    }

    generateRiskAssessment(category) {
        return [
            { risk: 'Technical complexity underestimation', probability: 'Medium', impact: 'High', mitigation: 'Detailed technical spike and prototyping' },
            { risk: 'Scope creep during development', probability: 'High', impact: 'Medium', mitigation: 'Clear requirements documentation and change control process' },
            { risk: 'Third-party service dependencies', probability: 'Low', impact: 'High', mitigation: 'Fallback options and service monitoring' },
            { risk: 'Performance bottlenecks at scale', probability: 'Medium', impact: 'Medium', mitigation: 'Load testing and performance optimization' }
        ];
    }

    generateSuccessMetrics(category) {
        const metrics = {
            'web-app': ['User engagement rate', 'Page conversion rate', 'Site performance scores', 'User satisfaction ratings'],
            'mobile-app': ['App store ratings', 'User retention rate', 'Feature adoption rate', 'Crash-free sessions'],
            'api': ['API response times', 'Request success rate', 'Developer adoption', 'Documentation usage'],
            'data-science': ['Model accuracy', 'Data processing speed', 'Business impact metrics', 'User adoption of insights']
        };

        return metrics[category] || ['Project completion rate', 'Quality metrics', 'User adoption', 'Performance benchmarks'];
    }

    generateBriefDocument(brief) {
        // Create downloadable project brief document
        const documentContent = this.formatBriefForDownload(brief);
        const blob = new Blob([documentContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);

        // Add download button to brief section
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-secondary';
        downloadBtn.innerHTML = '📄 Download Brief';
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-brief.md';
            a.click();
        };

        const briefSection = document.querySelector('.step-brief');
        const existingBtn = briefSection.querySelector('.btn-secondary');
        if (existingBtn) existingBtn.remove();
        briefSection.appendChild(downloadBtn);
    }

    formatBriefForDownload(brief) {
        return `# Project Brief

## Overview
${brief.overview.replace(/<[^>]*>/g, '')}

## Objectives
${brief.objectives.map(obj => `- ${obj}`).join('\n')}

## Features
${brief.features.map(feature => `### ${feature.name}
- **Priority:** ${feature.priority}
- **Effort:** ${feature.effort}
- **Description:** ${feature.description}
${feature.dependencies.length > 0 ? `- **Dependencies:** ${feature.dependencies.join(', ')}` : ''}
`).join('\n')}

## Technical Requirements
${brief.technicalRequirements.replace(/<[^>]*>/g, '')}

## Timeline
**Total Duration:** ${brief.timeline.total}

### Project Phases
${brief.timeline.phases.map(phase => `- **${phase.name}:** ${phase.duration}`).join('\n')}

## Budget Estimate
**Total Estimated Cost:** ${brief.budget.estimated}

### Cost Breakdown
${brief.budget.breakdown.map(item => `- ${item.category}: ${item.percentage}%`).join('\n')}

## Risk Assessment
${brief.risks.map(risk => `### ${risk.risk}
- **Probability:** ${risk.probability}
- **Impact:** ${risk.impact}
- **Mitigation:** ${risk.mitigation}
`).join('\n')}

## Success Metrics
${brief.success_metrics.map(metric => `- ${metric}`).join('\n')}

---
*Generated by Claude Code Project Brainstorming Tool*
`;
    }

    populateSetupSummary() {
        const idea = document.getElementById('project-idea').value.trim();
        const projectName = this.generateProjectName(idea);

        document.getElementById('setup-project-name').textContent = projectName;
        document.getElementById('setup-project-type').textContent = this.getCategoryDisplayName(this.selectedCategory);
        document.getElementById('setup-tech-stack').textContent = `${this.projectAnalysis.techStack.frontend.split(',')[0]} + ${this.projectAnalysis.techStack.backend.split(',')[0]}`;
        document.getElementById('setup-duration').textContent = this.estimateProjectDuration();

        // Pre-fill final settings
        document.getElementById('final-project-name').value = projectName;
        document.getElementById('final-project-path').value = `/Volumes/Extreme SSD/Workspace/${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        // Generate guided development workflow
        this.generateDevelopmentWorkflow();
    }

    generateDevelopmentWorkflow() {
        const workflow = this.createDevelopmentPhases(this.selectedCategory, this.projectAnalysis);
        this.displayDevelopmentWorkflow(workflow);
    }

    createDevelopmentPhases(category, analysis) {
        const basePhases = {
            'web-app': [
                {
                    name: 'Project Setup',
                    duration: '1-2 days',
                    tasks: [
                        'Initialize project repository',
                        'Set up development environment',
                        'Configure build tools and bundler',
                        'Set up testing framework',
                        'Create project structure'
                    ],
                    deliverables: ['Working development environment', 'CI/CD pipeline setup']
                },
                {
                    name: 'Core Architecture',
                    duration: '3-5 days',
                    tasks: [
                        'Design component architecture',
                        'Set up routing system',
                        'Implement state management',
                        'Create API integration layer',
                        'Set up authentication system'
                    ],
                    deliverables: ['App shell with routing', 'Authentication flow', 'API service layer']
                },
                {
                    name: 'Feature Development',
                    duration: '2-4 weeks',
                    tasks: analysis.keyFeatures.map(feature => `Implement ${feature}`),
                    deliverables: analysis.keyFeatures.map(feature => `Working ${feature}`)
                },
                {
                    name: 'Testing & Polish',
                    duration: '1-2 weeks',
                    tasks: [
                        'Write unit tests',
                        'Implement integration tests',
                        'Performance optimization',
                        'UI/UX refinement',
                        'Cross-browser testing'
                    ],
                    deliverables: ['Test coverage >80%', 'Performance benchmarks', 'Production-ready build']
                },
                {
                    name: 'Deployment',
                    duration: '2-3 days',
                    tasks: [
                        'Set up production environment',
                        'Configure domain and SSL',
                        'Deploy application',
                        'Set up monitoring',
                        'Create backup strategy'
                    ],
                    deliverables: ['Live application', 'Monitoring dashboard', 'Deployment documentation']
                }
            ],
            'mobile-app': [
                {
                    name: 'Development Setup',
                    duration: '2-3 days',
                    tasks: [
                        'Set up React Native/Flutter environment',
                        'Configure device simulators',
                        'Initialize project with navigation',
                        'Set up testing environment',
                        'Configure build tools'
                    ],
                    deliverables: ['Working development environment', 'Basic app shell']
                },
                {
                    name: 'Core App Structure',
                    duration: '1 week',
                    tasks: [
                        'Implement navigation system',
                        'Create component library',
                        'Set up state management',
                        'Implement authentication',
                        'Design app architecture'
                    ],
                    deliverables: ['App navigation flow', 'Authentication system', 'Core components']
                },
                {
                    name: 'Feature Implementation',
                    duration: '3-5 weeks',
                    tasks: analysis.keyFeatures.map(feature => `Build ${feature}`),
                    deliverables: analysis.keyFeatures.map(feature => `${feature} functionality`)
                },
                {
                    name: 'Testing & Optimization',
                    duration: '1-2 weeks',
                    tasks: [
                        'Device testing on multiple platforms',
                        'Performance optimization',
                        'Memory leak detection',
                        'Battery usage optimization',
                        'App store preparation'
                    ],
                    deliverables: ['Tested app build', 'Performance report', 'App store assets']
                },
                {
                    name: 'App Store Release',
                    duration: '3-5 days',
                    tasks: [
                        'Prepare app store listings',
                        'Submit for review',
                        'Set up analytics',
                        'Create release notes',
                        'Plan marketing strategy'
                    ],
                    deliverables: ['Published app', 'Analytics setup', 'Release documentation']
                }
            ],
            'api': [
                {
                    name: 'API Design',
                    duration: '2-3 days',
                    tasks: [
                        'Design API endpoints',
                        'Create OpenAPI specification',
                        'Set up project structure',
                        'Configure development environment',
                        'Set up database schema'
                    ],
                    deliverables: ['API specification', 'Database design', 'Project skeleton']
                },
                {
                    name: 'Core Implementation',
                    duration: '1-2 weeks',
                    tasks: [
                        'Implement authentication middleware',
                        'Create database models',
                        'Build core API endpoints',
                        'Set up validation layers',
                        'Implement error handling'
                    ],
                    deliverables: ['Working API endpoints', 'Authentication system', 'Data models']
                },
                {
                    name: 'Feature Development',
                    duration: '2-3 weeks',
                    tasks: analysis.keyFeatures.map(feature => `Develop ${feature} endpoint`),
                    deliverables: analysis.keyFeatures.map(feature => `${feature} API`)
                },
                {
                    name: 'Testing & Documentation',
                    duration: '1 week',
                    tasks: [
                        'Write comprehensive tests',
                        'Create API documentation',
                        'Set up performance testing',
                        'Implement monitoring',
                        'Security audit'
                    ],
                    deliverables: ['Test suite', 'API documentation', 'Security report']
                },
                {
                    name: 'Production Deployment',
                    duration: '2-3 days',
                    tasks: [
                        'Set up production infrastructure',
                        'Configure load balancing',
                        'Deploy API service',
                        'Set up monitoring and alerts',
                        'Create backup procedures'
                    ],
                    deliverables: ['Production API', 'Monitoring setup', 'Deployment guide']
                }
            ]
        };

        return basePhases[category] || basePhases['web-app'];
    }

    displayDevelopmentWorkflow(workflow) {
        const workflowContainer = document.querySelector('.development-workflow');
        if (!workflowContainer) return;

        const workflowHTML = `
            <div class="workflow-header">
                <h3>🚀 Development Roadmap</h3>
                <p>Structured approach to building your project</p>
            </div>
            <div class="workflow-phases">
                ${workflow.map((phase, index) => `
                    <div class="workflow-phase" data-phase="${index}">
                        <div class="phase-header">
                            <div class="phase-number">${index + 1}</div>
                            <div class="phase-info">
                                <h4>${phase.name}</h4>
                                <span class="phase-duration">${phase.duration}</span>
                            </div>
                            <button class="phase-toggle" onclick="workspaceManager.togglePhaseDetails(${index})">
                                <span class="toggle-icon">▼</span>
                            </button>
                        </div>
                        <div class="phase-details" id="phase-details-${index}">
                            <div class="phase-tasks">
                                <h5>📋 Tasks</h5>
                                <ul>
                                    ${phase.tasks.map(task => `<li>${task}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="phase-deliverables">
                                <h5>✅ Deliverables</h5>
                                <ul>
                                    ${phase.deliverables.map(deliverable => `<li>${deliverable}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="phase-actions">
                                <button class="btn btn-sm btn-primary" onclick="workspaceManager.startPhase(${index})">
                                    Start Phase
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="workspaceManager.createPhaseTemplate(${index})">
                                    Generate Template
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="workflow-actions">
                <button class="btn btn-success" onclick="workspaceManager.startGuidedDevelopment()">
                    🎯 Start Guided Development
                </button>
                <button class="btn btn-info" onclick="workspaceManager.exportWorkflowPlan()">
                    📊 Export Development Plan
                </button>
            </div>
        `;

        workflowContainer.innerHTML = workflowHTML;
        this.developmentWorkflow = workflow;
    }

    togglePhaseDetails(phaseIndex) {
        const details = document.getElementById(`phase-details-${phaseIndex}`);
        const toggle = document.querySelector(`[data-phase="${phaseIndex}"] .toggle-icon`);

        if (details.style.display === 'none' || !details.style.display) {
            details.style.display = 'block';
            toggle.textContent = '▲';
        } else {
            details.style.display = 'none';
            toggle.textContent = '▼';
        }
    }

    startPhase(phaseIndex) {
        const phase = this.developmentWorkflow[phaseIndex];
        const projectName = document.getElementById('final-project-name').value;

        // Create a detailed phase plan
        const phaseTemplate = this.generatePhaseTemplate(phase, projectName);

        // Show phase startup modal
        this.showPhaseStartupModal(phase, phaseTemplate);
    }

    generatePhaseTemplate(phase, projectName) {
        return {
            name: phase.name,
            duration: phase.duration,
            checklist: phase.tasks.map(task => ({ task, completed: false, notes: '' })),
            deliverables: phase.deliverables.map(deliverable => ({ item: deliverable, status: 'pending' })),
            startDate: new Date().toISOString().split('T')[0],
            resources: this.getPhaseResources(phase.name),
            commands: this.getPhaseCommands(phase.name, projectName)
        };
    }

    getPhaseResources(phaseName) {
        const resources = {
            'Project Setup': [
                'https://docs.npmjs.com/creating-a-package-json-file',
                'https://webpack.js.org/guides/getting-started/',
                'https://jestjs.io/docs/getting-started'
            ],
            'Core Architecture': [
                'https://reactjs.org/docs/thinking-in-react.html',
                'https://redux-toolkit.js.org/tutorials/quick-start',
                'https://reactrouter.com/web/guides/quick-start'
            ],
            'Feature Development': [
                'https://developer.mozilla.org/en-US/docs/Web/API',
                'https://axios-http.com/docs/intro',
                'https://styled-components.com/docs'
            ]
        };

        return resources[phaseName] || ['https://developer.mozilla.org/'];
    }

    getPhaseCommands(phaseName, projectName) {
        const commands = {
            'Project Setup': [
                `mkdir ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                `cd ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                'npm init -y',
                'git init',
                'npm install react react-dom',
                'npm install --save-dev webpack webpack-cli webpack-dev-server'
            ],
            'Core Architecture': [
                'npm install react-router-dom',
                'npm install @reduxjs/toolkit react-redux',
                'mkdir src/components src/pages src/services',
                'touch src/App.js src/index.js'
            ],
            'Testing & Polish': [
                'npm install --save-dev jest @testing-library/react',
                'npm run test',
                'npm run build',
                'npm audit fix'
            ]
        };

        return commands[phaseName] || [];
    }

    showPhaseStartupModal(phase, template) {
        const modal = document.createElement('div');
        modal.className = 'modal phase-startup-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🚀 Starting Phase: ${phase.name}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="phase-overview">
                        <p><strong>Duration:</strong> ${phase.duration}</p>
                        <p><strong>Start Date:</strong> ${template.startDate}</p>
                    </div>
                    <div class="phase-commands">
                        <h4>📝 Commands to Run</h4>
                        <div class="command-list">
                            ${template.commands.map(cmd => `
                                <div class="command-item">
                                    <code>${cmd}</code>
                                    <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${cmd}')">Copy</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="phase-resources">
                        <h4>📚 Helpful Resources</h4>
                        <ul>
                            ${template.resources.map(resource => `
                                <li><a href="${resource}" target="_blank">${resource}</a></li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="workspaceManager.createProjectWithPhase('${phase.name}')">
                        Create Project & Start Phase
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    startGuidedDevelopment() {
        // Start the entire guided development process
        const projectSettings = {
            name: document.getElementById('final-project-name').value,
            path: document.getElementById('final-project-path').value,
            approach: document.querySelector('input[name="project-approach"]:checked')?.value || 'standard'
        };

        this.createProjectWithGuidedWorkflow(projectSettings);
    }

    async createProjectWithGuidedWorkflow(settings) {
        try {
            // Create the project first
            const projectData = {
                name: settings.name,
                path: settings.path,
                category: this.selectedCategory,
                analysis: this.projectAnalysis,
                workflow: this.developmentWorkflow,
                approach: settings.approach
            };

            // Call the API to create project with workflow
            const response = await fetch('/api/projects/create-with-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });

            const result = await response.json();

            if (result.success) {
                this.addActivity(`Created project with guided workflow: ${settings.name}`);
                this.closeBrainstormModal();
                this.loadProjectById(result.projectId);
                this.showWorkflowTracker(result.projectId);
            } else {
                throw new Error(result.error || 'Failed to create project');
            }
        } catch (error) {
            console.error('Error creating project with workflow:', error);
            this.addActivity(`Error creating project: ${error.message}`);
        }
    }

    exportWorkflowPlan() {
        const projectName = document.getElementById('final-project-name').value;
        const plan = this.generateWorkflowDocument(projectName, this.developmentWorkflow);

        const blob = new Blob([plan], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}-development-plan.md`;
        a.click();
    }

    generateWorkflowDocument(projectName, workflow) {
        return `# ${projectName} - Development Plan

## Project Overview
- **Category:** ${this.getCategoryDisplayName(this.selectedCategory)}
- **Tech Stack:** ${this.projectAnalysis.techStack.frontend} + ${this.projectAnalysis.techStack.backend}
- **Estimated Duration:** ${this.estimateProjectDuration()}

## Development Phases

${workflow.map((phase, index) => `
### Phase ${index + 1}: ${phase.name}
**Duration:** ${phase.duration}

#### Tasks
${phase.tasks.map(task => `- [ ] ${task}`).join('\n')}

#### Deliverables
${phase.deliverables.map(deliverable => `- [ ] ${deliverable}`).join('\n')}

---
`).join('')}

## Getting Started
1. Set up your development environment
2. Follow each phase in order
3. Check off tasks as you complete them
4. Review deliverables before moving to next phase

*Generated by Claude Code Project Brainstorming Tool*
`;
    }

    generateProjectName(idea) {
        const keywords = idea.toLowerCase().split(' ').filter(word => word.length > 3);
        if (keywords.length > 0) {
            const mainKeyword = keywords[0];
            const suffixes = ['Hub', 'Pro', 'App', 'Platform', 'Studio', 'Lab', 'Works'];
            const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
            return mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1) + suffix;
        }
        return 'MyAwesomeProject';
    }

    getCategoryDisplayName(category) {
        const names = {
            'web-app': 'Web Application',
            'mobile-app': 'Mobile Application',
            'api': 'API Service',
            'data-science': 'Data Science Project',
            'automation': 'Automation Tool',
            'game': 'Game Development',
            'tool': 'Utility Tool',
            'other': 'Custom Project'
        };
        return names[category] || 'Web Application';
    }

    estimateProjectDuration() {
        const featureCount = this.projectAnalysis.keyFeatures ? this.projectAnalysis.keyFeatures.length : 5;
        if (featureCount <= 3) return '3-4 weeks';
        if (featureCount <= 5) return '4-6 weeks';
        if (featureCount <= 7) return '6-8 weeks';
        return '8-12 weeks';
    }

    regenerateAnalysis() {
        const idea = document.getElementById('project-idea').value.trim();
        if (idea) {
            this.generateProjectAnalysis(idea);
        }
    }

    editBrief() {
        // In a real implementation, this would open an editable version
        this.showNotification('Brief editing feature coming soon!', 'info');
    }

    exportBrief() {
        // Export the project brief as a text file
        const brief = document.getElementById('project-brief-document').innerText;
        const blob = new Blob([brief], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project-brief.txt';
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('Project brief exported!', 'success');
    }

    async createProjectFromBrainstorm() {
        const finalName = document.getElementById('final-project-name').value.trim();
        const finalPath = document.getElementById('final-project-path').value.trim();
        const approach = this.selectedApproach || 'bmad';

        if (!finalName || !finalPath) {
            this.showNotification('Please fill in project name and path', 'error');
            return;
        }

        // Show loading state
        const createBtn = document.getElementById('create-from-brainstorm');
        const originalText = createBtn.textContent;
        createBtn.textContent = 'Creating...';
        createBtn.disabled = true;

        try {
            let projectData;

            if (approach === 'bmad') {
                // Create with BMAD
                const templateType = this.determineBmadTemplate();
                projectData = {
                    name: finalName,
                    description: this.projectAnalysis.enhancedConcept,
                    targetFolder: finalPath,
                    template: templateType,
                    initGit: true,
                    createReadme: true,
                    createGitignore: true,
                    claudeConfig: {
                        enabled: true,
                        model: 'claude-3-5-sonnet-20241022',
                        temperature: 0.7,
                        maxTokens: 4000,
                        context: `This project was created through brainstorming: ${this.projectAnalysis.enhancedConcept}`
                    },
                    bmadConfig: {
                        enabled: true,
                        workflow: this.determineWorkflow(),
                        agents: this.determineAgents(),
                        template: this.determineBmadTemplateId()
                    }
                };
            } else {
                // Standard setup
                projectData = {
                    name: finalName,
                    description: this.projectAnalysis.enhancedConcept,
                    targetFolder: finalPath,
                    template: this.determineStandardTemplate(),
                    initGit: true,
                    createReadme: true,
                    createGitignore: true,
                    claudeConfig: {
                        enabled: true,
                        model: 'claude-3-5-sonnet-20241022',
                        temperature: 0.7,
                        maxTokens: 4000,
                        context: `This project was created through brainstorming: ${this.projectAnalysis.enhancedConcept}`
                    },
                    bmadConfig: {
                        enabled: false
                    }
                };
            }

            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            const result = await response.json();

            if (result.success) {
                this.addActivity(`Created project from brainstorming: ${finalName}`);
                this.closeBrainstormModal();
                await this.loadProjects();

                // Auto-select the new project
                setTimeout(() => {
                    const selector = document.getElementById('project-selector');
                    selector.value = result.data.id;
                    this.loadProject(result.data.id);
                }, 500);

                this.showNotification('Project created successfully from brainstorming!', 'success');

                // Auto-start BMAD if enabled
                if (approach === 'bmad') {
                    setTimeout(() => {
                        this.startBmadWorkflow();
                        this.switchTab('bmad');
                    }, 1000);
                }

            } else {
                throw new Error(result.message || 'Failed to create project');
            }
        } catch (error) {
            console.error('Error creating project from brainstorm:', error);
            this.showNotification(`Error creating project: ${error.message}`, 'error');
        } finally {
            createBtn.textContent = originalText;
            createBtn.disabled = false;
        }
    }

    determineBmadTemplate() {
        const category = this.selectedCategory || 'web-app';
        const templateMap = {
            'web-app': 'bmad-startup-mvp',
            'mobile-app': 'bmad-agile-team',
            'api': 'bmad-enterprise',
            'data-science': 'bmad-data-science',
            'automation': 'bmad-custom',
            'default': 'bmad-startup-mvp'
        };
        return templateMap[category] || templateMap.default;
    }

    determineBmadTemplateId() {
        const category = this.selectedCategory || 'web-app';
        const templateMap = {
            'web-app': 'startup-mvp',
            'mobile-app': 'agile-team',
            'api': 'enterprise',
            'data-science': 'data-science',
            'automation': 'custom',
            'default': 'startup-mvp'
        };
        return templateMap[category] || templateMap.default;
    }

    determineWorkflow() {
        const category = this.selectedCategory || 'web-app';
        const workflowMap = {
            'web-app': 'lean',
            'mobile-app': 'agile',
            'api': 'waterfall',
            'data-science': 'experimental',
            'automation': 'custom',
            'default': 'agile'
        };
        return workflowMap[category] || workflowMap.default;
    }

    determineAgents() {
        const category = this.selectedCategory || 'web-app';
        const agentMap = {
            'web-app': ['dev', 'design', 'product'],
            'mobile-app': ['dev', 'scrum-master', 'qa'],
            'api': ['dev', 'architect', 'security'],
            'data-science': ['data-scientist', 'ml-engineer', 'dev'],
            'automation': ['dev'],
            'default': ['dev', 'design']
        };
        return agentMap[category] || agentMap.default;
    }

    determineStandardTemplate() {
        const category = this.selectedCategory || 'web-app';
        const templateMap = {
            'web-app': 'react-app',
            'mobile-app': 'react-app',
            'api': 'node-express',
            'data-science': 'python-flask',
            'automation': 'node-express',
            'default': 'react-app'
        };
        return templateMap[category] || templateMap.default;
    }
}

// Initialize workspace manager
let workspaceManager;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, creating WorkspaceManager...');
    workspaceManager = new WorkspaceManager();

    // Make WorkspaceManager available globally for HTML onclick handlers
    window.workspaceManager = workspaceManager;
    console.log('✅ WorkspaceManager assigned to window.workspaceManager');

    // Debug: Force reload projects after a delay to ensure everything is ready
    setTimeout(() => {
        console.log('🔧 DEBUG: Force-reloading projects after delay...');
        if (workspaceManager) {
            workspaceManager.loadProjects();
        }
    }, 2000);

    // Test: Add a dummy project option to verify the selector is working
    setTimeout(() => {
        const selector = document.getElementById('project-selector');
        if (selector) {
            console.log('🧪 Found project selector, adding test option...');
            const testOption = document.createElement('option');
            testOption.value = 'test';
            testOption.textContent = '🧪 Test Project (Debug)';
            selector.appendChild(testOption);
            console.log('🧪 Test option added. Current option count:', selector.options.length);
        } else {
            console.error('❌ Could not find project-selector element!');
        }
    }, 3000);
});

// Handle window resize for terminals
window.addEventListener('resize', () => {
    if (workspaceManager) {
        workspaceManager.terminals.forEach(terminal => {
            if (terminal.xterm && terminal.xterm.fit) {
                terminal.xterm.fit();
            }
        });
    }
});
