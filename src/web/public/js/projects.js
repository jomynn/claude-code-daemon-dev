/**
 * Projects Page JavaScript
 * Handles project management, Claude Code integration, and BMAD workflows
 */

class ProjectManager {
    constructor() {
        this.projects = [];
        this.selectedProjects = new Set();
        this.currentProject = null;
        this.socket = null;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupSocketConnection();
        await this.loadProjects();
        this.updateStats();
    }

    setupEventListeners() {
        // Create project button
        document.getElementById('create-project-btn').addEventListener('click', () => {
            this.openCreateProjectModal();
        });

        // Search and filter
        document.getElementById('search-projects').addEventListener('input', (e) => {
            this.filterProjects(e.target.value);
        });

        document.getElementById('filter-status').addEventListener('change', (e) => {
            this.filterProjectsByStatus(e.target.value);
        });

        // Modal handlers
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModals();
            });
        });

        // Create project form
        document.getElementById('create-project-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createProject();
        });

        // Cancel create
        document.getElementById('cancel-create').addEventListener('click', () => {
            this.closeModals();
        });

        // Quick actions
        document.getElementById('batch-claude-start').addEventListener('click', () => {
            this.batchStartClaude();
        });

        document.getElementById('batch-bmad-start').addEventListener('click', () => {
            this.batchStartBmad();
        });

        document.getElementById('clone-github-repo').addEventListener('click', () => {
            this.cloneGitHubRepo();
        });

        document.getElementById('export-projects').addEventListener('click', () => {
            this.exportProjects();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Browse folder button
        document.getElementById('browse-folder').addEventListener('click', () => {
            this.browseFolder();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
    }

    setupSocketConnection() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            document.getElementById('connection-status').classList.remove('offline');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            document.getElementById('connection-status').classList.add('offline');
        });

        this.socket.on('project-update', (data) => {
            this.handleProjectUpdate(data);
        });

        this.socket.on('claude-output', (data) => {
            this.handleClaudeOutput(data);
        });

        this.socket.on('bmad-update', (data) => {
            this.handleBmadUpdate(data);
        });
    }

    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            const data = await response.json();

            if (data.success) {
                this.projects = data.data;
                this.renderProjects();
                this.updateStats();
            } else {
                this.showError('Failed to load projects: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to load projects: ' + error.message);
        }
    }

    renderProjects(projectsToRender = this.projects) {
        const grid = document.getElementById('projects-grid');

        if (projectsToRender.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>No projects found</h3>
                    <p>Create your first project to get started with Claude Code and BMAD workflows.</p>
                    <button class="btn btn-primary" onclick="projectManager.openCreateProjectModal()">
                        Create Project
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = projectsToRender.map(project => this.createProjectCard(project)).join('');
    }

    createProjectCard(project) {
        const statusClass = this.getProjectStatusClass(project.status);
        const hasGitHub = project.githubRepo ? '🔗' : '';
        const fileCount = project.stats?.fileCount || 0;

        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <h3 class="project-title">${this.escapeHtml(project.name)}</h3>
                    <span class="project-status ${statusClass}">${project.status?.exists ? 'Active' : 'Inactive'}</span>
                </div>

                <p class="project-description">${this.escapeHtml(project.description || 'No description provided')}</p>

                <div class="project-meta">
                    <div class="meta-item">
                        <span class="meta-icon">📁</span>
                        <span>${fileCount} files</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">📅</span>
                        <span>${this.formatDate(project.createdAt)}</span>
                    </div>
                    ${hasGitHub ? `
                        <div class="meta-item">
                            <span class="meta-icon">📋</span>
                            <span>GitHub</span>
                        </div>
                    ` : ''}
                </div>

                <div class="project-actions">
                    <button class="action-btn" onclick="projectManager.openProject('${project.id}')">
                        Open
                    </button>
                    <button class="action-btn" onclick="projectManager.startClaude('${project.id}')">
                        Claude Code
                    </button>
                    <button class="action-btn" onclick="projectManager.startBmad('${project.id}')">
                        BMAD
                    </button>
                    <button class="action-btn" onclick="projectManager.editProject('${project.id}')">
                        Edit
                    </button>
                    <button class="action-btn" onclick="projectManager.deleteProject('${project.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    getProjectStatusClass(status) {
        if (!status || !status.exists) return 'inactive';
        if (status.error) return 'error';
        return 'active';
    }

    openCreateProjectModal() {
        document.getElementById('create-project-modal').style.display = 'block';
        // Set default target folder
        document.getElementById('target-folder').value = '/Users/' + (window.navigator?.platform?.includes('Mac') ? 'username' : 'user') + '/Documents/claude-projects/';
    }

    async createProject() {
        const form = document.getElementById('create-project-form');
        const formData = new FormData(form);

        // Get checkbox values for BMAD agents
        const bmadAgents = Array.from(formData.getAll('bmadAgents'));

        const projectData = {
            name: formData.get('name'),
            description: formData.get('description'),
            targetFolder: formData.get('targetFolder'),
            githubRepo: formData.get('githubRepo') || null,
            claudeConfig: {
                enabled: true,
                model: formData.get('claudeModel') || 'claude-3-5-sonnet-20241022',
                maxTokens: parseInt(formData.get('maxTokens')) || 4000,
                temperature: parseFloat(formData.get('temperature')) || 0.7
            },
            bmadConfig: {
                enabled: true,
                agents: bmadAgents,
                workflow: formData.get('workflowType') || 'standard'
            }
        };

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Project created successfully!');
                this.closeModals();
                await this.loadProjects();
            } else {
                this.showError('Failed to create project: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to create project: ' + error.message);
        }
    }

    async openProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        this.currentProject = project;
        document.getElementById('project-title').textContent = project.name;
        document.getElementById('project-details-modal').style.display = 'block';

        // Load project details
        await this.loadProjectDetails(projectId);
    }

    async loadProjectDetails(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}`);
            const data = await response.json();

            if (data.success) {
                this.currentProject = data.data;
                this.renderProjectOverview();
                this.loadProjectFiles();
            }
        } catch (error) {
            this.showError('Failed to load project details: ' + error.message);
        }
    }

    renderProjectOverview() {
        const overview = document.getElementById('overview-tab');
        const project = this.currentProject;

        overview.innerHTML = `
            <div class="project-overview">
                <div class="overview-section">
                    <h4>Project Information</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Name:</span>
                            <span class="info-value">${this.escapeHtml(project.name)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Target Folder:</span>
                            <span class="info-value">${this.escapeHtml(project.targetFolder)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">GitHub Repository:</span>
                            <span class="info-value">${project.githubRepo ? `<a href="${project.githubRepo}" target="_blank">${project.githubRepo}</a>` : 'Not connected'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Created:</span>
                            <span class="info-value">${this.formatDate(project.createdAt)}</span>
                        </div>
                    </div>
                </div>

                <div class="overview-section">
                    <h4>Claude Code Configuration</h4>
                    <div class="config-grid">
                        <div class="config-item">
                            <span class="config-label">Model:</span>
                            <span class="config-value">${project.claudeConfig.model}</span>
                        </div>
                        <div class="config-item">
                            <span class="config-label">Max Tokens:</span>
                            <span class="config-value">${project.claudeConfig.maxTokens}</span>
                        </div>
                        <div class="config-item">
                            <span class="config-label">Temperature:</span>
                            <span class="config-value">${project.claudeConfig.temperature}</span>
                        </div>
                    </div>
                </div>

                <div class="overview-section">
                    <h4>BMAD Configuration</h4>
                    <div class="config-grid">
                        <div class="config-item">
                            <span class="config-label">Agents:</span>
                            <span class="config-value">${project.bmadConfig.agents.join(', ')}</span>
                        </div>
                        <div class="config-item">
                            <span class="config-label">Workflow:</span>
                            <span class="config-value">${project.bmadConfig.workflow}</span>
                        </div>
                    </div>
                </div>

                <div class="overview-actions">
                    <button class="btn btn-primary" onclick="projectManager.startClaude('${project.id}')">
                        Start Claude Code
                    </button>
                    <button class="btn btn-primary" onclick="projectManager.startBmad('${project.id}')">
                        Start BMAD Workflow
                    </button>
                </div>
            </div>
        `;
    }

    async loadProjectFiles() {
        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/files`);
            const data = await response.json();

            if (data.success) {
                this.renderFileExplorer(data.data);
            }
        } catch (error) {
            console.error('Failed to load project files:', error);
        }
    }

    renderFileExplorer(fileStructure) {
        const filesTab = document.getElementById('files-tab');
        filesTab.innerHTML = `
            <div class="file-explorer">
                <div class="file-explorer-header">
                    <h4>Project Files</h4>
                    <button class="btn btn-secondary" onclick="projectManager.refreshFiles()">Refresh</button>
                </div>
                <div class="file-tree">
                    ${this.renderFileTree(fileStructure)}
                </div>
            </div>
        `;
    }

    renderFileTree(item, depth = 0) {
        if (!item) return '';

        const indent = '  '.repeat(depth);
        let html = '';

        if (item.type === 'directory') {
            html += `<div class="file-item directory" style="margin-left: ${depth * 20}px">📁 ${item.name}</div>`;
            if (item.children) {
                item.children.forEach(child => {
                    html += this.renderFileTree(child, depth + 1);
                });
            }
        } else {
            html += `<div class="file-item file" style="margin-left: ${depth * 20}px">📄 ${item.name}</div>`;
        }

        return html;
    }

    async startClaude(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/start-claude`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Claude Code started successfully!');
                this.updateClaudeInterface(result.data);
            } else {
                this.showError('Failed to start Claude Code: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to start Claude Code: ' + error.message);
        }
    }

    async startBmad(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/start-bmad`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workflowType: 'development',
                    agents: ['dev', 'qa', 'pm']
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('BMAD workflow started successfully!');
                this.updateBmadInterface(result.data);
            } else {
                this.showError('Failed to start BMAD workflow: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to start BMAD workflow: ' + error.message);
        }
    }

    updateClaudeInterface(claudeData) {
        const claudeTab = document.getElementById('claude-tab');
        claudeTab.innerHTML = `
            <div class="claude-interface">
                <div class="claude-status">
                    <h4>Claude Code Session</h4>
                    <div class="status-info">
                        <span class="status-dot active"></span>
                        <span>Running (PID: ${claudeData.pid})</span>
                    </div>
                </div>
                <div class="claude-output">
                    <pre id="claude-output-content">Claude Code started at ${claudeData.startedAt}\nCommand: ${claudeData.command}\n\nReady for development assistance...</pre>
                </div>
                <div class="claude-input">
                    <input type="text" id="claude-command" placeholder="Enter command or question for Claude..." class="terminal-input">
                    <button class="btn btn-primary" onclick="projectManager.sendClaudeCommand()">Send</button>
                </div>
            </div>
        `;
    }

    updateBmadInterface(bmadData) {
        const bmadTab = document.getElementById('bmad-tab');
        bmadTab.innerHTML = `
            <div class="bmad-interface">
                <div class="bmad-status">
                    <h4>BMAD Workflow: ${bmadData.type}</h4>
                    <div class="workflow-info">
                        <span class="status-dot active"></span>
                        <span>Status: ${bmadData.status}</span>
                        <span>ID: ${bmadData.id}</span>
                    </div>
                </div>
                <div class="bmad-agents">
                    <h5>Active Agents</h5>
                    <div class="agents-list">
                        ${bmadData.agents.map(agent => `
                            <div class="agent-item">
                                <span class="agent-name">${agent}</span>
                                <span class="agent-status active">Active</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="bmad-steps">
                    <h5>Workflow Steps</h5>
                    <div class="steps-list">
                        ${bmadData.steps.map(step => `
                            <div class="step-item ${step.status}">
                                <span class="step-number">${step.id}</span>
                                <span class="step-name">${step.name}</span>
                                <span class="step-status">${step.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    filterProjects(searchTerm) {
        const filtered = this.projects.filter(project =>
            project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderProjects(filtered);
    }

    filterProjectsByStatus(status) {
        if (!status) {
            this.renderProjects(this.projects);
            return;
        }

        const filtered = this.projects.filter(project => {
            const projectStatus = this.getProjectStatusClass(project.status);
            return projectStatus === status;
        });
        this.renderProjects(filtered);
    }

    updateStats() {
        const totalProjects = this.projects.length;
        const activeProjects = this.projects.filter(p => p.status?.exists).length;
        const githubRepos = this.projects.filter(p => p.githubRepo).length;

        document.getElementById('total-projects').textContent = totalProjects;
        document.getElementById('active-sessions').textContent = activeProjects;
        document.getElementById('github-repos').textContent = githubRepos;
        document.getElementById('success-rate').textContent = '95%'; // This would be calculated from actual data
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    browseFolder() {
        // In a real implementation, this would open a file picker
        // For now, we'll just focus on the input field
        const input = document.getElementById('target-folder');
        input.focus();
        this.showInfo('Please enter the full path to your project folder');
    }

    async batchStartClaude() {
        this.showInfo('Batch Claude Code start functionality coming soon!');
    }

    async batchStartBmad() {
        this.showInfo('Batch BMAD workflow start functionality coming soon!');
    }

    async cloneGitHubRepo() {
        const repoUrl = prompt('Enter GitHub repository URL:');
        if (repoUrl) {
            this.showInfo('GitHub repository cloning functionality coming soon!');
        }
    }

    async exportProjects() {
        const data = JSON.stringify(this.projects, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'claude-projects-export.json';
        a.click();

        URL.revokeObjectURL(url);
        this.showSuccess('Projects exported successfully!');
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showInfo(message) {
        this.showMessage(message, 'info');
    }

    showMessage(message, type) {
        // Create and show a toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        // Add toast styles if not already present
        if (!document.querySelector('.toast-container')) {
            const container = document.createElement('div');
            container.className = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
            `;
            document.body.appendChild(container);
        }

        toast.style.cssText = `
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)'};
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;

        document.querySelector('.toast-container').appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    // Socket event handlers
    handleProjectUpdate(data) {
        console.log('Project update:', data);
        this.loadProjects();
    }

    handleClaudeOutput(data) {
        const outputElement = document.getElementById('claude-output-content');
        if (outputElement) {
            outputElement.textContent += '\n' + data.output;
            outputElement.scrollTop = outputElement.scrollHeight;
        }
    }

    handleBmadUpdate(data) {
        console.log('BMAD update:', data);
        // Update the BMAD interface with new data
    }
}

// Initialize the project manager when the page loads
let projectManager;
document.addEventListener('DOMContentLoaded', () => {
    projectManager = new ProjectManager();
});

// Add required CSS animations
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

.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
}

.empty-state h3 {
    color: var(--text-primary);
    margin-bottom: 12px;
}

.info-grid, .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
}

.overview-section {
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
}

.overview-section:last-child {
    border-bottom: none;
}

.overview-section h4 {
    margin: 0 0 16px 0;
    color: var(--text-primary);
}

.overview-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
}

.claude-interface, .bmad-interface {
    padding: 20px;
}

.claude-status, .bmad-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
}

.status-info, .workflow-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.claude-output {
    background: #000;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 16px;
    font-family: monospace;
    font-size: 13px;
    color: #00ff00;
    height: 300px;
    overflow-y: auto;
    margin-bottom: 16px;
}

.claude-input {
    display: flex;
    gap: 12px;
    align-items: center;
}

.claude-input input {
    flex: 1;
}

.agents-list, .steps-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.agent-item, .step-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--dark-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
}

.agent-status, .step-status {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
}

.agent-status.active, .step-status.completed {
    background: rgba(76, 175, 80, 0.2);
    color: var(--success-color);
}

.step-status.running {
    background: rgba(33, 150, 243, 0.2);
    color: var(--primary-color);
}
`;
document.head.appendChild(style);