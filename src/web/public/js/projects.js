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
        await Promise.all([
            this.loadProjects(),
            this.loadBmadRoles(),
            this.loadBmadWorkflows()
        ]);
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

        const priorityFilter = document.getElementById('filter-priority');
        if (priorityFilter) {
            priorityFilter.addEventListener('change', (e) => {
                this.filterProjectsByPriority(e.target.value);
            });
        }

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
        const currentStatus = project.projectStatus || 'active';
        const priority = project.priority || 'normal';

        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <h3 class="project-title">${this.escapeHtml(project.name)}</h3>
                    <div class="project-controls">
                        <select class="status-selector" onchange="projectManager.changeProjectStatus('${project.id}', this.value)" title="Change Status">
                            <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>🟢 Active</option>
                            <option value="hold" ${currentStatus === 'hold' ? 'selected' : ''}>⏸️ On Hold</option>
                            <option value="completed" ${currentStatus === 'completed' ? 'selected' : ''}>✅ Completed</option>
                            <option value="archived" ${currentStatus === 'archived' ? 'selected' : ''}>📦 Archived</option>
                            <option value="delete" ${currentStatus === 'delete' ? 'selected' : ''}>🗑️ Delete</option>
                        </select>
                        <select class="priority-selector" onchange="projectManager.changeProjectPriority('${project.id}', this.value)" title="Change Priority">
                            <option value="low" ${priority === 'low' ? 'selected' : ''}>🔵 Low</option>
                            <option value="normal" ${priority === 'normal' ? 'selected' : ''}>⚪ Normal</option>
                            <option value="high" ${priority === 'high' ? 'selected' : ''}>🟠 High</option>
                            <option value="critical" ${priority === 'critical' ? 'selected' : ''}>🔴 Critical</option>
                        </select>
                    </div>
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
            return (project.projectStatus || 'active') === status;
        });
        this.renderProjects(filtered);
    }

    filterProjectsByPriority(priority) {
        if (!priority) {
            this.renderProjects(this.projects);
            return;
        }

        const filtered = this.projects.filter(project => {
            return (project.priority || 'normal') === priority;
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

    // Project status and priority management
    async changeProjectStatus(projectId, newStatus) {
        // Handle delete status separately
        if (newStatus === 'delete') {
            if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                // Reset the select to the previous value
                this.renderProjects();
                return;
            }
            await this.deleteProject(projectId);
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectStatus: newStatus
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update local project data
                const project = this.projects.find(p => p.id === projectId);
                if (project) {
                    project.projectStatus = newStatus;
                }
                this.showInfo(`Project status updated to ${newStatus}`);

                // Re-render to update UI
                this.renderProjects();
            } else {
                this.showError('Failed to update project status: ' + result.error);
                this.renderProjects(); // Re-render to reset the select
            }
        } catch (error) {
            this.showError('Failed to update project status: ' + error.message);
            this.renderProjects(); // Re-render to reset the select
        }
    }

    async changeProjectPriority(projectId, newPriority) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    priority: newPriority
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update local project data
                const project = this.projects.find(p => p.id === projectId);
                if (project) {
                    project.priority = newPriority;
                }
                this.showInfo(`Project priority updated to ${newPriority}`);

                // Re-render to update UI
                this.renderProjects();
            } else {
                this.showError('Failed to update project priority: ' + result.error);
                this.renderProjects(); // Re-render to reset the select
            }
        } catch (error) {
            this.showError('Failed to update project priority: ' + error.message);
            this.renderProjects(); // Re-render to reset the select
        }
    }

    async deleteProject(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                // Remove from local projects array
                this.projects = this.projects.filter(p => p.id !== projectId);
                this.showInfo('Project deleted successfully');

                // Re-render and update stats
                this.renderProjects();
                this.updateStats();
            } else {
                this.showError('Failed to delete project: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to delete project: ' + error.message);
        }
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

    // Enhanced BMAD functionality
    async loadBmadRoles() {
        try {
            const response = await fetch('/api/projects/bmad/roles');

            // Handle rate limiting
            if (response.status === 429) {
                console.warn('Rate limit exceeded for BMAD roles. Using fallback data.');
                this.bmadRoles = this.getFallbackRoles();
                this.bmadCategories = this.getFallbackCategories();
                return { roles: this.bmadRoles, categories: this.bmadCategories };
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                this.bmadRoles = result.data.roles;
                this.bmadCategories = result.data.categories;
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to load BMAD roles');
            }
        } catch (error) {
            console.error('Error loading BMAD roles:', error);
            // Use fallback data on error
            this.bmadRoles = this.getFallbackRoles();
            this.bmadCategories = this.getFallbackCategories();
            return { roles: this.bmadRoles, categories: this.bmadCategories };
        }
    }

    async loadBmadWorkflows() {
        try {
            const response = await fetch('/api/projects/bmad/workflows');

            // Handle rate limiting
            if (response.status === 429) {
                console.warn('Rate limit exceeded for BMAD workflows. Using fallback data.');
                this.bmadWorkflows = this.getFallbackWorkflows();
                return this.bmadWorkflows;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                this.bmadWorkflows = result.data;
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to load BMAD workflows');
            }
        } catch (error) {
            console.error('Error loading BMAD workflows:', error);
            // Use fallback data on error
            this.bmadWorkflows = this.getFallbackWorkflows();
            return this.bmadWorkflows;
        }
    }

    // Fallback data methods for when API is unavailable
    getFallbackRoles() {
        return {
            'dev': { name: 'Developer', description: 'Primary development role' },
            'qa': { name: 'Quality Assurance', description: 'Testing and quality control' },
            'pm': { name: 'Project Manager', description: 'Project coordination and management' },
            'design': { name: 'Designer', description: 'UI/UX design role' },
            'product': { name: 'Product Manager', description: 'Product strategy and requirements' }
        };
    }

    getFallbackCategories() {
        return {
            'core': ['dev', 'qa', 'pm'],
            'extended': ['design', 'product']
        };
    }

    getFallbackWorkflows() {
        return [
            {
                id: 'agile',
                name: 'Agile Development',
                description: 'Standard agile workflow with sprints',
                phases: ['planning', 'development', 'testing', 'review', 'deployment']
            },
            {
                id: 'lean',
                name: 'Lean Startup',
                description: 'Rapid prototyping and iteration',
                phases: ['ideation', 'prototype', 'test', 'learn', 'iterate']
            },
            {
                id: 'standard',
                name: 'Standard Development',
                description: 'Traditional waterfall-style development',
                phases: ['requirements', 'design', 'development', 'testing', 'deployment']
            }
        ];
    }

    renderBmadRoleSelector(selectedRoles = []) {
        if (!this.bmadRoles || !this.bmadCategories) {
            return '<p>Loading BMAD roles...</p>';
        }

        let html = '<div class="bmad-role-selector">';

        for (const [category, roles] of Object.entries(this.bmadCategories)) {
            html += `
                <div class="role-category">
                    <h4 class="category-title">${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                    <div class="roles-grid">
            `;

            for (const roleKey of roles) {
                const role = this.bmadRoles[roleKey];
                const isSelected = selectedRoles.includes(roleKey);
                html += `
                    <div class="role-item ${isSelected ? 'selected' : ''}" data-role="${roleKey}">
                        <div class="role-header">
                            <input type="checkbox"
                                   id="role-${roleKey}"
                                   name="bmadRoles"
                                   value="${roleKey}"
                                   ${isSelected ? 'checked' : ''}
                            >
                            <label for="role-${roleKey}" class="role-name">${role.name}</label>
                        </div>
                        <div class="role-description">${role.description}</div>
                        <div class="role-skills">
                            ${role.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    renderWorkflowSelector(selectedWorkflow = 'agile') {
        if (!this.bmadWorkflows) {
            return '<p>Loading workflows...</p>';
        }

        let html = '<div class="workflow-selector">';

        for (const [workflowKey, workflow] of Object.entries(this.bmadWorkflows)) {
            const isSelected = selectedWorkflow === workflowKey;
            html += `
                <div class="workflow-item ${isSelected ? 'selected' : ''}" data-workflow="${workflowKey}">
                    <input type="radio"
                           id="workflow-${workflowKey}"
                           name="bmadWorkflow"
                           value="${workflowKey}"
                           ${isSelected ? 'checked' : ''}
                    >
                    <label for="workflow-${workflowKey}">
                        <div class="workflow-name">${workflow.name}</div>
                        <div class="workflow-phases">
                            Phases: ${workflow.phases.join(' → ')}
                        </div>
                        <div class="workflow-roles">
                            Recommended: ${workflow.recommendedRoles.map(role =>
                                this.bmadRoles?.[role]?.name || role
                            ).join(', ')}
                        </div>
                    </label>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    // Terminal Interface functionality
    async createTerminal(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/terminal/create`, {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                this.showSuccess('Terminal session created successfully!');
                return result.data;
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error creating terminal:', error);
            this.showError('Failed to create terminal session');
        }
    }

    async sendTerminalCommand(projectId, terminalId, command) {
        try {
            const response = await fetch(`/api/projects/${projectId}/terminal/${terminalId}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });
            const result = await response.json();
            if (result.success) {
                return true;
            } else {
                this.showError(result.error);
                return false;
            }
        } catch (error) {
            console.error('Error sending terminal command:', error);
            this.showError('Failed to send command');
            return false;
        }
    }

    async getTerminalSessions(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/terminal/sessions`);
            const result = await response.json();
            if (result.success) {
                return result.data;
            }
        } catch (error) {
            console.error('Error getting terminal sessions:', error);
        }
        return [];
    }

    async terminateTerminal(projectId, terminalId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/terminal/${terminalId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                this.showSuccess('Terminal session terminated');
                return true;
            }
        } catch (error) {
            console.error('Error terminating terminal:', error);
            this.showError('Failed to terminate terminal');
        }
        return false;
    }

    renderTerminalInterface(project) {
        return `
            <div class="terminal-interface">
                <div class="terminal-header">
                    <h4>Terminal Sessions</h4>
                    <button class="btn" onclick="projectManager.createTerminal('${project.id}')">
                        New Terminal
                    </button>
                </div>
                <div class="terminal-sessions" id="terminal-sessions-${project.id}">
                    <!-- Terminal sessions will be loaded here -->
                </div>
                <div class="terminal-console">
                    <div class="console-header">
                        <span>Console Output</span>
                        <button class="btn-small" onclick="this.nextElementSibling.innerHTML = ''">Clear</button>
                    </div>
                    <div class="console-output" id="console-output-${project.id}"></div>
                    <div class="console-input">
                        <input type="text"
                               placeholder="Enter command..."
                               onkeypress="if(event.key==='Enter') projectManager.executeTerminalCommand('${project.id}', this.value, this)"
                        >
                        <button class="btn" onclick="projectManager.executeTerminalCommand('${project.id}', this.previousElementSibling.value, this.previousElementSibling)">
                            Execute
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async executeTerminalCommand(projectId, command, inputElement) {
        if (!command.trim()) return;

        // Get the first available terminal session or create one
        let sessions = await this.getTerminalSessions(projectId);
        let terminalId;

        if (sessions.length === 0) {
            const newTerminal = await this.createTerminal(projectId);
            if (newTerminal) {
                terminalId = newTerminal.terminalId;
            }
        } else {
            terminalId = sessions.find(s => s.status === 'running')?.terminalId || sessions[0].terminalId;
        }

        if (terminalId) {
            const success = await this.sendTerminalCommand(projectId, terminalId, command);
            if (success) {
                // Add command to console output
                const consoleOutput = document.getElementById(`console-output-${projectId}`);
                if (consoleOutput) {
                    consoleOutput.innerHTML += `<div class="console-line">$ ${command}</div>`;
                    consoleOutput.scrollTop = consoleOutput.scrollHeight;
                }

                // Clear input
                if (inputElement) {
                    inputElement.value = '';
                }
            }
        }
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

/* Enhanced BMAD Styles */
.bmad-role-selector {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 15px;
}

.role-category {
    margin-bottom: 25px;
}

.category-title {
    color: var(--primary-color);
    font-size: 16px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--border-color);
}

.roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 10px;
}

.role-item {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    transition: all 0.3s;
}

.role-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--primary-color);
}

.role-item.selected {
    border-color: var(--primary-color);
    background: rgba(33, 150, 243, 0.1);
}

.role-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
}

.role-name {
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
}

.role-description {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
}

.role-skills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.skill-tag {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-secondary);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
}

.workflow-selector {
    display: grid;
    gap: 15px;
}

.workflow-item {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.02);
    transition: all 0.3s;
}

.workflow-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--primary-color);
}

.workflow-item.selected {
    border-color: var(--primary-color);
    background: rgba(33, 150, 243, 0.1);
}

.workflow-name {
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 5px;
}

.workflow-phases,
.workflow-roles {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 3px;
}

/* Terminal Interface Styles */
.terminal-interface {
    background: var(--dark-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
}

.terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid var(--border-color);
}

.terminal-header h4 {
    margin: 0;
    color: var(--text-primary);
    font-size: 14px;
}

.terminal-sessions {
    padding: 10px;
    border-bottom: 1px solid var(--border-color);
}

.terminal-console {
    height: 300px;
    display: flex;
    flex-direction: column;
}

.console-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid var(--border-color);
    font-size: 12px;
    color: var(--text-secondary);
}

.console-output {
    flex: 1;
    background: #000;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 10px;
    overflow-y: auto;
    white-space: pre-wrap;
}

.console-line {
    margin-bottom: 2px;
}

.console-input {
    display: flex;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-top: 1px solid var(--border-color);
}

.console-input input {
    flex: 1;
    background: var(--dark-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 6px 10px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
}

.console-input button {
    margin-left: 8px;
    padding: 6px 12px;
    font-size: 12px;
}

.btn-small {
    padding: 4px 8px;
    font-size: 11px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
}

.btn-small:hover {
    background: #1976D2;
}
`;
document.head.appendChild(style);