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
        this.setupEventListeners();
        this.setupSocketConnection();
        this.loadProjects();
        this.initializeTabs();
        this.startResourceMonitoring();
        this.setupProjectCreation();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Project selector
        document.getElementById('project-selector').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadProject(e.target.value);
            }
        });

        // Claude Code controls
        document.getElementById('start-claude-btn').addEventListener('click', () => {
            this.startClaude();
        });

        document.getElementById('stop-claude-btn').addEventListener('click', () => {
            this.stopClaude();
        });

        document.getElementById('restart-claude-btn').addEventListener('click', () => {
            this.restartClaude();
        });

        // Claude input
        document.getElementById('claude-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendClaudeMessage();
            }
        });

        document.getElementById('send-claude-btn').addEventListener('click', () => {
            this.sendClaudeMessage();
        });

        // Collaboration input
        document.getElementById('collab-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendCollabMessage();
            }
        });

        // New workspace button
        document.getElementById('new-workspace-btn').addEventListener('click', () => {
            this.createNewWorkspace();
        });

        // Split view and fullscreen
        document.getElementById('split-view-btn').addEventListener('click', () => {
            this.toggleSplitView();
        });

        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });
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
    }

    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            const result = await response.json();

            if (result.success) {
                const selector = document.getElementById('project-selector');
                selector.innerHTML = '<option value="">Select Project...</option>';

                result.data.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.name;
                    selector.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading projects:', error);
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

    updateClaudeUI(running) {
        const status = document.getElementById('claude-running-status');
        const statusBadge = document.getElementById('claude-status');
        const input = document.getElementById('claude-input');
        const sendBtn = document.getElementById('send-claude-btn');
        const startBtn = document.getElementById('start-claude-btn');
        const stopBtn = document.getElementById('stop-claude-btn');
        const restartBtn = document.getElementById('restart-claude-btn');

        if (running) {
            status.textContent = 'Running';
            statusBadge.textContent = 'Running';
            statusBadge.className = 'status-badge running';
            input.disabled = false;
            sendBtn.disabled = false;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            restartBtn.disabled = false;
        } else {
            status.textContent = 'Stopped';
            statusBadge.textContent = 'Stopped';
            statusBadge.className = 'status-badge stopped';
            input.disabled = true;
            sendBtn.disabled = true;
            startBtn.disabled = false;
            stopBtn.disabled = true;
            restartBtn.disabled = true;
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

        // New Project button
        document.getElementById('new-project-btn').addEventListener('click', () => {
            this.openNewProjectModal();
        });

        // Step navigation
        document.getElementById('next-step-btn').addEventListener('click', () => {
            this.nextStep();
        });

        document.getElementById('prev-step-btn').addEventListener('click', () => {
            this.prevStep();
        });

        document.getElementById('create-project-btn').addEventListener('click', () => {
            this.createProject();
        });

        // Toggle configurations
        document.getElementById('enable-claude').addEventListener('change', (e) => {
            document.getElementById('claude-config').style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('enable-bmad').addEventListener('change', (e) => {
            document.getElementById('bmad-config').style.display = e.target.checked ? 'block' : 'none';
        });

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
    }

    openNewProjectModal() {
        document.getElementById('new-project-modal').style.display = 'flex';
        this.resetProjectForm();
    }

    closeNewProjectModal() {
        document.getElementById('new-project-modal').style.display = 'none';
        this.resetProjectForm();
    }

    resetProjectForm() {
        this.currentStep = 0;
        document.getElementById('new-project-form').reset();
        this.updateStepDisplay();

        // Reset configurations
        document.getElementById('claude-config').style.display = 'block';
        document.getElementById('bmad-config').style.display = 'none';
        document.querySelector('.range-value').textContent = '0.7';
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
        // Hide all step sections
        document.querySelectorAll('.step-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show current step
        document.getElementById(`step-${this.steps[this.currentStep]}`).classList.add('active');

        // Update progress steps
        document.querySelectorAll('.progress-steps .step').forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index < this.currentStep) {
                step.classList.add('completed');
            } else if (index === this.currentStep) {
                step.classList.add('active');
            }
        });

        // Update buttons
        document.getElementById('prev-step-btn').style.display = this.currentStep > 0 ? 'inline-block' : 'none';
        document.getElementById('next-step-btn').style.display = this.currentStep < this.steps.length - 1 ? 'inline-block' : 'none';
        document.getElementById('create-project-btn').style.display = this.currentStep === this.steps.length - 1 ? 'inline-block' : 'none';
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
        const formData = {
            name: document.getElementById('project-name').value.trim(),
            description: document.getElementById('project-description').value.trim(),
            targetFolder: document.getElementById('project-path').value.trim(),
            template: document.getElementById('project-template').value,
            githubRepo: document.getElementById('github-repo').value.trim() || null,
            initGit: document.getElementById('init-git').checked,
            createReadme: document.getElementById('create-readme').checked,
            createGitignore: document.getElementById('create-gitignore').checked
        };

        // Claude Code configuration
        const claudeEnabled = document.getElementById('enable-claude').checked;
        formData.claudeConfig = {
            enabled: claudeEnabled,
            model: claudeEnabled ? document.getElementById('claude-model').value : 'claude-3-5-sonnet-20241022',
            temperature: claudeEnabled ? parseFloat(document.getElementById('claude-temperature').value) : 0.7,
            maxTokens: claudeEnabled ? parseInt(document.getElementById('claude-max-tokens').value) : 4000,
            context: claudeEnabled ? document.getElementById('claude-context').value.trim() : ''
        };

        // BMAD configuration
        const bmadEnabled = document.getElementById('enable-bmad').checked;
        formData.bmadConfig = {
            enabled: bmadEnabled,
            workflow: bmadEnabled ? document.getElementById('bmad-workflow').value : 'agile',
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
}

// Initialize workspace manager
let workspaceManager;
document.addEventListener('DOMContentLoaded', () => {
    workspaceManager = new WorkspaceManager();
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