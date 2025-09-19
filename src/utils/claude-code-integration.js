/**
 * Claude Code Integration Utilities
 * Wrapper for Claude Code CLI and process management
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ClaudeCodeIntegration extends EventEmitter {
    constructor(options = {}) {
        super();
        this.processes = new Map(); // Store active Claude Code processes
        this.defaultConfig = {
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4000,
            temperature: 0.7,
            ...options
        };
    }

    /**
     * Start Claude Code for a specific project
     */
    async startClaudeCode(project) {
        try {
            const processId = `claude-${project.id}`;

            // Check if Claude Code is already running for this project
            if (this.processes.has(processId)) {
                return {
                    success: false,
                    error: 'Claude Code is already running for this project'
                };
            }

            // Prepare Claude Code configuration
            const config = {
                ...this.defaultConfig,
                ...project.claudeConfig
            };

            // Create Claude Code process
            const claudeProcess = await this.createClaudeProcess(project, config);

            // Store the process
            this.processes.set(processId, {
                process: claudeProcess,
                project,
                config,
                startedAt: new Date(),
                status: 'running'
            });

            this.emit('claude-started', {
                projectId: project.id,
                processId,
                pid: claudeProcess.pid
            });

            return {
                success: true,
                processId,
                pid: claudeProcess.pid,
                status: 'running',
                startedAt: new Date().toISOString(),
                config
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Stop Claude Code for a specific project
     */
    async stopClaudeCode(projectId) {
        try {
            const processId = `claude-${projectId}`;
            const processInfo = this.processes.get(processId);

            if (!processInfo) {
                return {
                    success: false,
                    error: 'Claude Code is not running for this project'
                };
            }

            // Gracefully terminate the process
            processInfo.process.kill('SIGTERM');

            // Wait for process to exit or force kill after timeout
            setTimeout(() => {
                if (!processInfo.process.killed) {
                    processInfo.process.kill('SIGKILL');
                }
            }, 5000);

            this.processes.delete(processId);

            this.emit('claude-stopped', {
                projectId,
                processId,
                stoppedAt: new Date().toISOString()
            });

            return {
                success: true,
                message: 'Claude Code stopped successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send a command/message to Claude Code
     */
    async sendCommand(projectId, command) {
        try {
            const processId = `claude-${projectId}`;
            const processInfo = this.processes.get(processId);

            if (!processInfo) {
                return {
                    success: false,
                    error: 'Claude Code is not running for this project'
                };
            }

            // Write command to Claude Code stdin
            processInfo.process.stdin.write(command + '\n');

            return {
                success: true,
                message: 'Command sent to Claude Code'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get the status of all Claude Code processes
     */
    getProcessStatus() {
        const status = {};

        for (const [processId, processInfo] of this.processes) {
            status[processId] = {
                projectId: processInfo.project.id,
                projectName: processInfo.project.name,
                pid: processInfo.process.pid,
                status: processInfo.status,
                startedAt: processInfo.startedAt,
                uptime: Date.now() - processInfo.startedAt.getTime(),
                config: processInfo.config
            };
        }

        return status;
    }

    /**
     * Create a Claude Code process for a project
     */
    async createClaudeProcess(project, config) {
        // Check if Claude Code CLI is available
        const availability = await this.checkClaudeCodeAvailability();

        if (availability.available) {
            // Use real Claude Code CLI
            return this.createRealClaudeProcess(project, config);
        } else {
            // Fall back to mock process for development
            console.warn('Claude Code CLI not available, using mock process');
            return this.createMockClaudeProcess(project, config);
        }
    }

    /**
     * Create a mock Claude Code process for development/testing
     */
    createMockClaudeProcess(project, config) {
        // This simulates the Claude Code CLI process
        // In production, this would be replaced with the actual Claude Code binary

        const mockProcess = spawn('node', ['-e', `
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            console.log('Claude Code v1.0.0 started for project: ${project.name}');
            console.log('Model: ${config.model}');
            console.log('Max Tokens: ${config.maxTokens}');
            console.log('Temperature: ${config.temperature}');
            console.log('Working Directory: ${project.targetFolder}');
            console.log('Ready for commands...');

            rl.on('line', (input) => {
                if (input.trim() === 'exit' || input.trim() === 'quit') {
                    console.log('Claude Code session ended.');
                    process.exit(0);
                }

                // Simulate Claude's response
                console.log(\`Claude: I understand you want to "\${input}". Let me help you with that in the context of your project.\`);
                console.log('Claude: [This is a simulated response for development]');
                console.log('Ready for next command...');
            });

            // Keep the process alive
            setInterval(() => {
                // Heartbeat
            }, 10000);
        `], {
            cwd: project.targetFolder,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Set up process event handlers
        this.setupProcessHandlers(mockProcess, project);

        return mockProcess;
    }

    /**
     * Set up event handlers for a Claude Code process
     */
    setupProcessHandlers(claudeProcess, project) {
        const processId = `claude-${project.id}`;

        claudeProcess.stdout.on('data', (data) => {
            const output = data.toString();
            this.emit('claude-output', {
                projectId: project.id,
                processId,
                type: 'stdout',
                output,
                timestamp: new Date().toISOString()
            });
        });

        claudeProcess.stderr.on('data', (data) => {
            const output = data.toString();
            this.emit('claude-output', {
                projectId: project.id,
                processId,
                type: 'stderr',
                output,
                timestamp: new Date().toISOString()
            });
        });

        claudeProcess.on('close', (code) => {
            const processInfo = this.processes.get(processId);
            if (processInfo) {
                processInfo.status = 'stopped';
                this.processes.delete(processId);
            }

            this.emit('claude-closed', {
                projectId: project.id,
                processId,
                exitCode: code,
                timestamp: new Date().toISOString()
            });
        });

        claudeProcess.on('error', (error) => {
            this.emit('claude-error', {
                projectId: project.id,
                processId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Create a real Claude Code process using the actual CLI
     */
    createRealClaudeProcess(project, config) {
        // Use the actual Claude Code CLI
        const claudeProcess = spawn('claude', [], {
            cwd: project.targetFolder,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                // Add any environment variables Claude Code might need
                CLAUDE_MODEL: config.model,
                CLAUDE_MAX_TOKENS: config.maxTokens.toString(),
                CLAUDE_TEMPERATURE: config.temperature.toString()
            }
        });

        // Set up process event handlers
        this.setupProcessHandlers(claudeProcess, project);

        return claudeProcess;
    }

    /**
     * Check if Claude Code CLI is available
     */
    async checkClaudeCodeAvailability() {
        try {
            // Try to run claude --version
            const output = execSync('claude --version', { encoding: 'utf8' });
            return {
                available: true,
                version: output.trim()
            };
        } catch (error) {
            // If claude command is not found, check for alternative commands
            const alternatives = ['claude-code', 'claude-cli', 'anthropic-claude'];

            for (const cmd of alternatives) {
                try {
                    const output = execSync(`${cmd} --version`, { encoding: 'utf8' });
                    return {
                        available: true,
                        command: cmd,
                        version: output.trim()
                    };
                } catch (altError) {
                    continue;
                }
            }

            return {
                available: false,
                error: 'Claude Code CLI not found. Please install it first.',
                suggestion: 'npm install -g @anthropic-ai/claude-code'
            };
        }
    }

    /**
     * Install Claude Code CLI (if needed)
     */
    async installClaudeCode() {
        try {
            console.log('Installing Claude Code CLI...');
            execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit' });

            return {
                success: true,
                message: 'Claude Code CLI installed successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                suggestion: 'Please install Claude Code CLI manually'
            };
        }
    }

    /**
     * Create a project configuration file for Claude Code
     */
    async createClaudeConfig(project) {
        try {
            const configDir = path.join(project.targetFolder, '.claude');
            await fs.mkdir(configDir, { recursive: true });

            const config = {
                model: project.claudeConfig.model,
                maxTokens: project.claudeConfig.maxTokens,
                temperature: project.claudeConfig.temperature,
                projectName: project.name,
                projectDescription: project.description,
                excludePaths: [
                    'node_modules',
                    '.git',
                    'dist',
                    'build',
                    'coverage',
                    '.claude-daemon'
                ],
                includePaths: [
                    'src',
                    'lib',
                    'components',
                    'utils',
                    'tests'
                ]
            };

            const configPath = path.join(configDir, 'config.json');
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));

            return {
                success: true,
                configPath
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get project statistics for Claude Code integration
     */
    async getProjectStats(project) {
        try {
            const stats = {
                totalFiles: 0,
                codeFiles: 0,
                totalLines: 0,
                languages: {},
                lastModified: null
            };

            await this.scanDirectory(project.targetFolder, stats);

            return {
                success: true,
                stats
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Recursively scan directory for project statistics
     */
    async scanDirectory(dir, stats, depth = 0) {
        if (depth > 10) return; // Prevent infinite recursion

        try {
            const items = await fs.readdir(dir);

            for (const item of items) {
                if (item.startsWith('.') || item === 'node_modules') continue;

                const itemPath = path.join(dir, item);
                const stat = await fs.stat(itemPath);

                if (stat.isDirectory()) {
                    await this.scanDirectory(itemPath, stats, depth + 1);
                } else {
                    stats.totalFiles++;

                    const ext = path.extname(item).toLowerCase();
                    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'];

                    if (codeExtensions.includes(ext)) {
                        stats.codeFiles++;

                        const lang = this.getLanguageFromExtension(ext);
                        stats.languages[lang] = (stats.languages[lang] || 0) + 1;
                    }

                    if (!stats.lastModified || stat.mtime > stats.lastModified) {
                        stats.lastModified = stat.mtime;
                    }
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
    }

    /**
     * Get programming language from file extension
     */
    getLanguageFromExtension(ext) {
        const langMap = {
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust'
        };

        return langMap[ext] || 'Other';
    }

    /**
     * Clean up all processes
     */
    async cleanup() {
        for (const [processId, processInfo] of this.processes) {
            try {
                processInfo.process.kill('SIGTERM');
            } catch (error) {
                console.error(`Error terminating process ${processId}:`, error);
            }
        }
        this.processes.clear();
    }
}

module.exports = ClaudeCodeIntegration;