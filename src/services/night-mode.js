/**
 * Night Mode Automatic Development Service
 * Handles autonomous project development while users sleep
 */

const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

class NightModeService extends EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.currentProject = null;
        this.developmentQueue = [];
        this.claudeConnection = null;
        this.progress = {
            startTime: null,
            endTime: null,
            tasksCompleted: [],
            errors: [],
            summary: []
        };
        this.config = {
            startHour: 23,  // 11 PM
            endHour: 6,     // 6 AM
            maxRetries: 3,
            checkInterval: 60000, // 1 minute
            autoCommit: true,
            autoTest: true,
            autoDeploy: false
        };
    }

    /**
     * Initialize night mode service
     */
    async initialize() {
        console.log('🌙 Initializing Night Mode Service...');
        await this.loadConfiguration();
        this.startScheduler();
        this.setupEventHandlers();
    }

    /**
     * Load night mode configuration
     */
    async loadConfiguration() {
        const configPath = path.join(__dirname, '../../config/night-mode.json');
        if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            this.config = { ...this.config, ...config };
        }
    }

    /**
     * Start the night mode scheduler
     */
    startScheduler() {
        setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();

            // Check if it's night time
            const isNightTime = currentHour >= this.config.startHour || currentHour < this.config.endHour;

            if (isNightTime && !this.isActive && this.developmentQueue.length > 0) {
                this.startNightMode();
            } else if (!isNightTime && this.isActive) {
                this.stopNightMode();
            }
        }, this.config.checkInterval);
    }

    /**
     * Start night mode development
     */
    async startNightMode() {
        console.log('🌙 Starting Night Mode Automatic Development...');
        this.isActive = true;
        this.progress.startTime = new Date();
        this.emit('night-mode:started');

        try {
            // Process development queue
            while (this.developmentQueue.length > 0 && this.isActive) {
                const project = this.developmentQueue.shift();
                await this.developProject(project);
            }
        } catch (error) {
            console.error('❌ Night mode error:', error);
            this.progress.errors.push({
                time: new Date(),
                error: error.message
            });
        }

        if (this.isActive) {
            await this.generateMorningSummary();
            this.stopNightMode();
        }
    }

    /**
     * Stop night mode development
     */
    async stopNightMode() {
        console.log('☀️ Stopping Night Mode...');
        this.isActive = false;
        this.progress.endTime = new Date();
        await this.saveSummary();
        this.emit('night-mode:stopped', this.progress);
    }

    /**
     * Queue a project for night development
     */
    async queueProject(projectData) {
        const project = {
            id: projectData.id,
            name: projectData.name,
            brief: projectData.brief,
            features: projectData.features || [],
            techStack: projectData.techStack || {},
            workflow: projectData.workflow || 'agile',
            priority: projectData.priority || 1,
            status: 'queued',
            queuedAt: new Date()
        };

        this.developmentQueue.push(project);
        this.developmentQueue.sort((a, b) => b.priority - a.priority);

        console.log(`📋 Project "${project.name}" queued for night development`);
        this.emit('project:queued', project);

        return project;
    }

    /**
     * Develop a project automatically
     */
    async developProject(project) {
        console.log(`🚀 Starting automatic development for: ${project.name}`);
        this.currentProject = project;
        project.status = 'in-progress';
        project.startedAt = new Date();

        const phases = [
            { name: 'setup', handler: this.setupProject },
            { name: 'scaffold', handler: this.scaffoldProject },
            { name: 'implement', handler: this.implementFeatures },
            { name: 'test', handler: this.runTests },
            { name: 'optimize', handler: this.optimizeCode },
            { name: 'document', handler: this.generateDocumentation }
        ];

        for (const phase of phases) {
            if (!this.isActive) break;

            try {
                console.log(`📍 Phase: ${phase.name}`);
                await phase.handler.call(this, project);

                this.progress.tasksCompleted.push({
                    project: project.name,
                    phase: phase.name,
                    completedAt: new Date()
                });

                this.emit('phase:completed', {
                    project: project.name,
                    phase: phase.name
                });

            } catch (error) {
                console.error(`❌ Error in phase ${phase.name}:`, error);
                this.progress.errors.push({
                    project: project.name,
                    phase: phase.name,
                    error: error.message,
                    time: new Date()
                });

                // Retry logic
                if (project.retries < this.config.maxRetries) {
                    project.retries = (project.retries || 0) + 1;
                    console.log(`🔄 Retrying phase ${phase.name} (attempt ${project.retries}/${this.config.maxRetries})`);
                    await this.delay(5000);
                    continue;
                }
            }
        }

        project.status = 'completed';
        project.completedAt = new Date();
        this.currentProject = null;

        console.log(`✅ Project "${project.name}" development completed`);
        this.emit('project:completed', project);
    }

    /**
     * Setup project environment
     */
    async setupProject(project) {
        const tasks = [
            'Creating project directory',
            'Initializing git repository',
            'Setting up package.json',
            'Installing dependencies',
            'Creating project structure'
        ];

        for (const task of tasks) {
            await this.communicateWithClaude({
                action: 'setup',
                task,
                project: project.name
            });
            await this.delay(2000);
        }
    }

    /**
     * Scaffold project structure
     */
    async scaffoldProject(project) {
        const structure = this.getProjectStructure(project.techStack);

        await this.communicateWithClaude({
            action: 'scaffold',
            structure,
            project: project.name,
            techStack: project.techStack
        });
    }

    /**
     * Implement project features
     */
    async implementFeatures(project) {
        for (const feature of project.features) {
            if (!this.isActive) break;

            console.log(`💻 Implementing: ${feature.name}`);

            await this.communicateWithClaude({
                action: 'implement',
                feature: feature,
                project: project.name,
                context: project.brief
            });

            // Auto-commit if enabled
            if (this.config.autoCommit) {
                await this.commitChanges(project, `feat: implement ${feature.name}`);
            }

            await this.delay(3000);
        }
    }

    /**
     * Run automated tests
     */
    async runTests(project) {
        if (!this.config.autoTest) return;

        console.log('🧪 Running automated tests...');

        const testResults = await this.communicateWithClaude({
            action: 'test',
            project: project.name,
            testTypes: ['unit', 'integration', 'e2e']
        });

        if (testResults.failures > 0) {
            await this.fixFailingTests(project, testResults);
        }
    }

    /**
     * Optimize code
     */
    async optimizeCode(project) {
        console.log('⚡ Optimizing code...');

        await this.communicateWithClaude({
            action: 'optimize',
            project: project.name,
            optimizations: ['performance', 'bundle-size', 'code-quality']
        });
    }

    /**
     * Generate project documentation
     */
    async generateDocumentation(project) {
        console.log('📚 Generating documentation...');

        await this.communicateWithClaude({
            action: 'document',
            project: project.name,
            types: ['README', 'API', 'USER_GUIDE']
        });
    }

    /**
     * Communicate with Claude Code daemon
     */
    async communicateWithClaude(instruction) {
        return new Promise((resolve, reject) => {
            const message = {
                type: 'night-mode',
                timestamp: new Date(),
                instruction,
                sessionId: this.currentProject?.id
            };

            // Send to Claude through daemon
            this.emit('claude:request', message);

            // Simulate Claude response for now
            setTimeout(() => {
                const response = {
                    success: true,
                    action: instruction.action,
                    result: `Completed: ${instruction.action}`,
                    details: instruction
                };

                this.emit('claude:response', response);
                resolve(response);
            }, 1000);
        });
    }

    /**
     * Commit changes to git
     */
    async commitChanges(project, message) {
        return new Promise((resolve, reject) => {
            const git = spawn('git', ['commit', '-am', `[Night Mode] ${message}`], {
                cwd: project.path
            });

            git.on('close', (code) => {
                if (code === 0) {
                    console.log(`📝 Committed: ${message}`);
                    resolve();
                } else {
                    reject(new Error(`Git commit failed with code ${code}`));
                }
            });
        });
    }

    /**
     * Generate morning summary report
     */
    async generateMorningSummary() {
        const duration = (this.progress.endTime || new Date()) - this.progress.startTime;
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);

        const summary = {
            date: new Date().toLocaleDateString(),
            duration: `${hours}h ${minutes}m`,
            projectsCompleted: this.getCompletedProjects().length,
            tasksCompleted: this.progress.tasksCompleted.length,
            errors: this.progress.errors.length,
            highlights: this.generateHighlights(),
            recommendations: this.generateRecommendations()
        };

        this.progress.summary = summary;
        console.log('📊 Morning summary generated');

        return summary;
    }

    /**
     * Save summary to file
     */
    async saveSummary() {
        const summaryPath = path.join(
            __dirname,
            '../../data/night-mode-summaries',
            `${new Date().toISOString().split('T')[0]}.json`
        );

        await fs.ensureDir(path.dirname(summaryPath));
        await fs.writeJson(summaryPath, this.progress, { spaces: 2 });

        console.log(`💾 Summary saved: ${summaryPath}`);
    }

    /**
     * Get completed projects
     */
    getCompletedProjects() {
        const projects = new Set();
        this.progress.tasksCompleted.forEach(task => {
            if (task.phase === 'document') {
                projects.add(task.project);
            }
        });
        return Array.from(projects);
    }

    /**
     * Generate highlights from development
     */
    generateHighlights() {
        const highlights = [];

        const completedProjects = this.getCompletedProjects();
        if (completedProjects.length > 0) {
            highlights.push(`✅ Completed ${completedProjects.length} project(s)`);
        }

        const features = this.progress.tasksCompleted.filter(t => t.phase === 'implement');
        if (features.length > 0) {
            highlights.push(`🚀 Implemented ${features.length} features`);
        }

        const tests = this.progress.tasksCompleted.filter(t => t.phase === 'test');
        if (tests.length > 0) {
            highlights.push(`🧪 Ran tests for ${tests.length} project(s)`);
        }

        return highlights;
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.progress.errors.length > 0) {
            recommendations.push({
                type: 'error',
                message: `Review ${this.progress.errors.length} errors that occurred during development`,
                priority: 'high'
            });
        }

        const incompleteProjects = this.developmentQueue.filter(p => p.status !== 'completed');
        if (incompleteProjects.length > 0) {
            recommendations.push({
                type: 'incomplete',
                message: `${incompleteProjects.length} project(s) require manual completion`,
                priority: 'medium'
            });
        }

        return recommendations;
    }

    /**
     * Get project structure based on tech stack
     */
    getProjectStructure(techStack) {
        const structures = {
            'react': ['src/components', 'src/pages', 'src/utils', 'public'],
            'node': ['src/routes', 'src/controllers', 'src/models', 'src/utils'],
            'python': ['src', 'tests', 'docs', 'requirements.txt'],
            'vue': ['src/components', 'src/views', 'src/store', 'public']
        };

        return structures[techStack.frontend] || structures[techStack.backend] || structures.node;
    }

    /**
     * Fix failing tests
     */
    async fixFailingTests(project, testResults) {
        console.log(`🔧 Fixing ${testResults.failures} failing tests...`);

        await this.communicateWithClaude({
            action: 'fix-tests',
            project: project.name,
            failures: testResults.failedTests
        });
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.on('claude:response', (response) => {
            if (response.success) {
                console.log(`✅ Claude: ${response.result}`);
            } else {
                console.error(`❌ Claude error: ${response.error}`);
            }
        });
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            currentProject: this.currentProject?.name || null,
            queueLength: this.developmentQueue.length,
            progress: this.progress,
            config: this.config
        };
    }

    /**
     * Update configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        const configPath = path.join(__dirname, '../../config/night-mode.json');
        await fs.writeJson(configPath, this.config, { spaces: 2 });
        console.log('⚙️ Night mode configuration updated');
    }
}

module.exports = NightModeService;