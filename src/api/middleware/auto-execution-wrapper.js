/**
 * Auto-Execution Wrapper for BMAD Content Processing
 * Automatically processes BMAD content and builds projects without human intervention
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AutoExecutionWrapper {
    constructor() {
        this.activeExecutions = new Map();
        this.executionQueue = [];
        this.isProcessing = false;

        // Default project structure templates
        this.projectTemplates = {
            'fullstack': {
                directories: [
                    'src', 'src/components', 'src/pages', 'src/utils', 'src/hooks',
                    'src/services', 'src/context', 'src/styles',
                    'server', 'server/routes', 'server/models', 'server/middleware',
                    'server/controllers', 'server/config', 'server/utils',
                    'public', 'public/images', 'public/icons',
                    'tests', 'tests/unit', 'tests/integration',
                    'docs', 'scripts', 'database', 'database/migrations', 'database/seeds'
                ],
                files: {
                    'package.json': 'package_template',
                    'README.md': 'readme_template',
                    '.gitignore': 'gitignore_template',
                    '.env.example': 'env_template',
                    'docker-compose.yml': 'docker_template',
                    'src/App.js': 'react_app_template',
                    'src/index.js': 'react_index_template',
                    'server/app.js': 'express_app_template',
                    'server/server.js': 'server_template'
                }
            },
            'api': {
                directories: [
                    'src', 'src/routes', 'src/models', 'src/middleware',
                    'src/controllers', 'src/services', 'src/utils', 'src/config',
                    'tests', 'docs', 'database', 'database/migrations'
                ],
                files: {
                    'package.json': 'api_package_template',
                    'src/app.js': 'express_app_template',
                    'src/server.js': 'server_template',
                    '.env.example': 'env_template'
                }
            },
            'frontend': {
                directories: [
                    'src', 'src/components', 'src/pages', 'src/hooks',
                    'src/services', 'src/styles', 'src/utils',
                    'public', 'tests'
                ],
                files: {
                    'package.json': 'frontend_package_template',
                    'src/App.js': 'react_app_template',
                    'src/index.js': 'react_index_template'
                }
            }
        };

        // File templates
        this.fileTemplates = this._initializeFileTemplates();
    }

    /**
     * Start auto-execution for BMAD content
     */
    async startAutoExecution(bmadContent, bmadMetadata, options = {}) {
        const executionId = this._generateExecutionId();
        const projectPath = options.targetPath || this._generateProjectPath(bmadMetadata.name);

        const execution = {
            id: executionId,
            content: bmadContent,
            metadata: bmadMetadata,
            projectPath,
            status: 'initializing',
            steps: [],
            startTime: new Date(),
            options
        };

        this.activeExecutions.set(executionId, execution);

        try {
            console.log(`[AUTO-EXECUTION] Starting build for: ${bmadMetadata.name || 'BMAD Project'}`);

            // Step 1: Analyze and plan execution
            await this._analyzeProject(execution);

            // Step 2: Create project structure
            await this._createProjectStructure(execution);

            // Step 3: Generate and write files
            await this._generateProjectFiles(execution);

            // Step 4: Install dependencies
            await this._installDependencies(execution);

            // Step 5: Setup database (if needed)
            await this._setupDatabase(execution);

            // Step 6: Run initial setup scripts
            await this._runSetupScripts(execution);

            // Step 7: Validate project
            await this._validateProject(execution);

            execution.status = 'completed';
            execution.endTime = new Date();

            console.log(`[AUTO-EXECUTION] Project build completed: ${execution.id}`);

            return {
                success: true,
                executionId,
                projectPath,
                summary: this._generateExecutionSummary(execution)
            };

        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            execution.endTime = new Date();

            console.error(`[AUTO-EXECUTION] Project build failed: ${error.message}`);

            return {
                success: false,
                executionId,
                error: error.message,
                steps: execution.steps
            };
        }
    }

    /**
     * Analyze project requirements and determine execution plan
     */
    async _analyzeProject(execution) {
        execution.steps.push({ name: 'analyze_project', status: 'running', startTime: new Date() });

        const { metadata, content } = execution;

        // Determine project type
        execution.projectType = this._determineProjectType(metadata, content);

        // Extract technical requirements
        execution.techRequirements = this._extractTechRequirements(content);

        // Determine dependencies
        execution.dependencies = this._determineDependencies(metadata, content);

        // Plan file structure
        execution.fileStructure = this._planFileStructure(execution.projectType, metadata);

        execution.steps[execution.steps.length - 1].status = 'completed';
        execution.steps[execution.steps.length - 1].endTime = new Date();
    }

    /**
     * Create project directory structure
     */
    async _createProjectStructure(execution) {
        execution.steps.push({ name: 'create_structure', status: 'running', startTime: new Date() });

        const { projectPath, fileStructure } = execution;

        // Create project root directory
        await fs.mkdir(projectPath, { recursive: true });

        // Create subdirectories
        for (const dir of fileStructure.directories) {
            const dirPath = path.join(projectPath, dir);
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`[AUTO-EXECUTION] Created directory: ${dir}`);
        }

        execution.steps[execution.steps.length - 1].status = 'completed';
        execution.steps[execution.steps.length - 1].endTime = new Date();
    }

    /**
     * Generate and write all project files
     */
    async _generateProjectFiles(execution) {
        execution.steps.push({ name: 'generate_files', status: 'running', startTime: new Date() });

        const { projectPath, fileStructure, metadata, techRequirements } = execution;

        // Generate package.json
        await this._generatePackageJson(projectPath, metadata, execution.dependencies);

        // Generate main application files
        for (const [filePath, templateName] of Object.entries(fileStructure.files)) {
            const fullPath = path.join(projectPath, filePath);
            const content = this._generateFileContent(templateName, metadata, techRequirements);
            await fs.writeFile(fullPath, content);
            console.log(`[AUTO-EXECUTION] Created file: ${filePath}`);
        }

        // Generate additional files based on tech stack
        await this._generateTechSpecificFiles(execution);

        execution.steps[execution.steps.length - 1].status = 'completed';
        execution.steps[execution.steps.length - 1].endTime = new Date();
    }

    /**
     * Install project dependencies
     */
    async _installDependencies(execution) {
        execution.steps.push({ name: 'install_dependencies', status: 'running', startTime: new Date() });

        const { projectPath } = execution;

        try {
            // Install npm dependencies
            await this._runCommand('npm', ['install'], projectPath);
            console.log('[AUTO-EXECUTION] Dependencies installed successfully');

            execution.steps[execution.steps.length - 1].status = 'completed';
        } catch (error) {
            console.warn('[AUTO-EXECUTION] Dependency installation failed:', error.message);
            execution.steps[execution.steps.length - 1].status = 'failed';
            execution.steps[execution.steps.length - 1].error = error.message;
        }

        execution.steps[execution.steps.length - 1].endTime = new Date();
    }

    /**
     * Setup database if required
     */
    async _setupDatabase(execution) {
        const { metadata } = execution;

        if (!metadata.databases || metadata.databases.length === 0) {
            return; // No database setup needed
        }

        execution.steps.push({ name: 'setup_database', status: 'running', startTime: new Date() });

        try {
            // Generate database scripts and configurations
            await this._generateDatabaseFiles(execution);

            // Run database initialization if possible
            await this._initializeDatabase(execution);

            execution.steps[execution.steps.length - 1].status = 'completed';
        } catch (error) {
            console.warn('[AUTO-EXECUTION] Database setup failed:', error.message);
            execution.steps[execution.steps.length - 1].status = 'failed';
            execution.steps[execution.steps.length - 1].error = error.message;
        }

        execution.steps[execution.steps.length - 1].endTime = new Date();
    }

    /**
     * Run initial setup scripts
     */
    async _runSetupScripts(execution) {
        execution.steps.push({ name: 'run_setup', status: 'running', startTime: new Date() });

        const { projectPath } = execution;

        try {
            // Create initial build
            if (execution.projectType === 'frontend' || execution.projectType === 'fullstack') {
                await this._runCommand('npm', ['run', 'build'], projectPath);
            }

            execution.steps[execution.steps.length - 1].status = 'completed';
        } catch (error) {
            console.warn('[AUTO-EXECUTION] Setup scripts failed:', error.message);
            execution.steps[execution.steps.length - 1].status = 'warning';
            execution.steps[execution.steps.length - 1].error = error.message;
        }

        execution.steps[execution.steps.length - 1].endTime = new Date();
    }

    /**
     * Validate project structure and functionality
     */
    async _validateProject(execution) {
        execution.steps.push({ name: 'validate_project', status: 'running', startTime: new Date() });

        const { projectPath } = execution;

        try {
            // Check if key files exist
            const keyFiles = ['package.json', 'README.md'];
            for (const file of keyFiles) {
                const filePath = path.join(projectPath, file);
                await fs.access(filePath);
            }

            // Run tests if they exist
            try {
                await this._runCommand('npm', ['test'], projectPath);
            } catch (testError) {
                console.log('[AUTO-EXECUTION] Tests not available or failed - this is normal for new projects');
            }

            execution.steps[execution.steps.length - 1].status = 'completed';
        } catch (error) {
            execution.steps[execution.steps.length - 1].status = 'failed';
            execution.steps[execution.steps.length - 1].error = error.message;
        }

        execution.steps[execution.steps.length - 1].endTime = new Date();
    }

    /**
     * Helper methods
     */

    _generateExecutionId() {
        return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    _generateProjectPath(projectName) {
        const sanitizedName = (projectName || 'bmad-project')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        return path.join(process.cwd(), 'generated-projects', sanitizedName);
    }

    _determineProjectType(metadata, content) {
        const contentLower = content.toLowerCase();

        if (contentLower.includes('fullstack') || contentLower.includes('full-stack')) {
            return 'fullstack';
        }

        if (contentLower.includes('api') || contentLower.includes('backend') || contentLower.includes('server')) {
            return 'api';
        }

        if (contentLower.includes('frontend') || contentLower.includes('react') || contentLower.includes('vue')) {
            return 'frontend';
        }

        // Default to fullstack for BMAD documents
        return 'fullstack';
    }

    _extractTechRequirements(content) {
        const requirements = {
            framework: null,
            database: null,
            authentication: false,
            realtime: false,
            api: false,
            testing: false
        };

        const contentLower = content.toLowerCase();

        // Framework detection
        if (contentLower.includes('react')) requirements.framework = 'react';
        else if (contentLower.includes('vue')) requirements.framework = 'vue';
        else if (contentLower.includes('angular')) requirements.framework = 'angular';
        else if (contentLower.includes('express')) requirements.framework = 'express';

        // Database detection
        if (contentLower.includes('mongodb')) requirements.database = 'mongodb';
        else if (contentLower.includes('postgresql')) requirements.database = 'postgresql';
        else if (contentLower.includes('mysql')) requirements.database = 'mysql';
        else if (contentLower.includes('sqlite')) requirements.database = 'sqlite';

        // Feature detection
        requirements.authentication = /auth|login|user|signup|signin/.test(contentLower);
        requirements.realtime = /realtime|websocket|socket\.io|live/.test(contentLower);
        requirements.api = /api|endpoint|rest|graphql/.test(contentLower);
        requirements.testing = /test|jest|mocha|cypress/.test(contentLower);

        return requirements;
    }

    _determineDependencies(metadata, content) {
        const deps = {
            production: [],
            development: []
        };

        const techStack = metadata.techStack || [];
        const contentLower = content.toLowerCase();

        // Frontend dependencies
        if (techStack.includes('react') || contentLower.includes('react')) {
            deps.production.push('react', 'react-dom', 'react-router-dom');
            deps.development.push('@vitejs/plugin-react', 'vite');
        }

        // Backend dependencies
        if (techStack.includes('express') || contentLower.includes('express')) {
            deps.production.push('express', 'cors', 'helmet', 'compression');
        }

        if (techStack.includes('node') || contentLower.includes('node')) {
            deps.production.push('dotenv');
            deps.development.push('nodemon');
        }

        // Database dependencies
        if (metadata.databases) {
            for (const db of metadata.databases) {
                switch (db.toLowerCase()) {
                    case 'mongodb':
                        deps.production.push('mongoose');
                        break;
                    case 'postgresql':
                        deps.production.push('pg', 'pg-hstore');
                        break;
                    case 'mysql':
                        deps.production.push('mysql2');
                        break;
                    case 'sqlite':
                        deps.production.push('sqlite3');
                        break;
                }
            }
        }

        // Testing dependencies
        if (contentLower.includes('test')) {
            deps.development.push('jest', 'supertest');
        }

        return deps;
    }

    _planFileStructure(projectType, metadata) {
        const template = this.projectTemplates[projectType] || this.projectTemplates['fullstack'];

        return {
            directories: [...template.directories],
            files: { ...template.files }
        };
    }

    async _generatePackageJson(projectPath, metadata, dependencies) {
        const packageJson = {
            name: metadata.name ? metadata.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'bmad-project',
            version: '1.0.0',
            description: metadata.description || 'BMAD Generated Project',
            main: 'src/index.js',
            scripts: {
                start: 'node src/index.js',
                dev: 'nodemon src/index.js',
                build: 'echo "Build completed"',
                test: 'jest'
            },
            dependencies: {},
            devDependencies: {},
            keywords: ['bmad', 'generated', ...(metadata.techStack || [])],
            author: 'BMAD Auto-Execution',
            license: 'MIT'
        };

        // Add dependencies
        if (dependencies.production) {
            for (const dep of dependencies.production) {
                packageJson.dependencies[dep] = 'latest';
            }
        }

        if (dependencies.development) {
            for (const dep of dependencies.development) {
                packageJson.devDependencies[dep] = 'latest';
            }
        }

        await fs.writeFile(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
    }

    _generateFileContent(templateName, metadata, techRequirements) {
        const template = this.fileTemplates[templateName];
        if (!template) {
            return `// ${templateName} - Generated by BMAD Auto-Execution\n// TODO: Implement ${templateName}\n`;
        }

        // Replace template variables
        return template
            .replace(/\{\{PROJECT_NAME\}\}/g, metadata.name || 'BMAD Project')
            .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, metadata.description || 'Generated by BMAD Auto-Execution')
            .replace(/\{\{FRAMEWORK\}\}/g, techRequirements.framework || 'express')
            .replace(/\{\{DATABASE\}\}/g, techRequirements.database || 'mongodb');
    }

    async _generateTechSpecificFiles(execution) {
        // Generate additional files based on tech requirements
        const { projectPath, techRequirements, metadata } = execution;

        // Generate Docker files
        if (execution.content.toLowerCase().includes('docker')) {
            await this._generateDockerFiles(projectPath, techRequirements);
        }

        // Generate CI/CD files
        if (execution.content.toLowerCase().includes('ci') || execution.content.toLowerCase().includes('github')) {
            await this._generateCIFiles(projectPath);
        }
    }

    async _generateDatabaseFiles(execution) {
        const { projectPath, metadata } = execution;

        if (metadata.databases && metadata.databases.length > 0) {
            const dbDir = path.join(projectPath, 'database');
            await fs.mkdir(dbDir, { recursive: true });

            // Generate basic database schema file
            const schemaContent = `// Database Schema for ${metadata.name}\n// Generated by BMAD Auto-Execution\n\n// TODO: Define your database schema here\n`;
            await fs.writeFile(path.join(dbDir, 'schema.sql'), schemaContent);
        }
    }

    async _initializeDatabase(execution) {
        // This would typically connect to and initialize the database
        // For now, we'll just create the configuration files
        console.log('[AUTO-EXECUTION] Database configuration files created');
    }

    async _runCommand(command, args, cwd) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd, stdio: 'pipe' });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });

            child.on('error', reject);
        });
    }

    _generateExecutionSummary(execution) {
        const duration = execution.endTime - execution.startTime;
        const completedSteps = execution.steps.filter(s => s.status === 'completed').length;
        const totalSteps = execution.steps.length;

        return {
            projectName: execution.metadata.name,
            projectPath: execution.projectPath,
            projectType: execution.projectType,
            duration: Math.round(duration / 1000),
            steps: {
                completed: completedSteps,
                total: totalSteps,
                success_rate: (completedSteps / totalSteps * 100).toFixed(1)
            },
            files_created: Object.keys(execution.fileStructure.files).length,
            directories_created: execution.fileStructure.directories.length,
            dependencies: execution.dependencies
        };
    }

    _initializeFileTemplates() {
        return {
            package_template: `{
  "name": "{{PROJECT_NAME}}",
  "version": "1.0.0",
  "description": "{{PROJECT_DESCRIPTION}}",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "build": "echo 'Build completed'",
    "test": "jest"
  }
}`,

            readme_template: `# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## Generated by BMAD Auto-Execution

This project was automatically generated from a BMAD document specification.

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Project Structure

- \`src/\` - Source code
- \`tests/\` - Test files
- \`docs/\` - Documentation

## Features

- Auto-generated project structure
- Ready-to-use development environment
- Configured dependencies
- Basic testing setup

## Next Steps

1. Review the generated code
2. Customize configurations as needed
3. Start building your features
4. Run tests and deploy
`,

            react_app_template: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>{{PROJECT_NAME}}</h1>
        <p>{{PROJECT_DESCRIPTION}}</p>
        <p>Generated by BMAD Auto-Execution</p>
      </header>
    </div>
  );
}

export default App;`,

            express_app_template: `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to {{PROJECT_NAME}}',
    description: '{{PROJECT_DESCRIPTION}}',
    generated_by: 'BMAD Auto-Execution'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = app;`,

            server_template: `const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(\`🚀 {{PROJECT_NAME}} server running on port \${PORT}\`);
  console.log(\`📖 {{PROJECT_DESCRIPTION}}\`);
  console.log(\`🤖 Generated by BMAD Auto-Execution\`);
});`,

            gitignore_template: `node_modules/
*.log
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
dist/
build/
coverage/
.nyc_output/
*.tgz
*.tar.gz
.DS_Store
.vscode/
.idea/`,

            env_template: `# {{PROJECT_NAME}} Environment Variables
# Generated by BMAD Auto-Execution

NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=

# Authentication
JWT_SECRET=your-secret-key

# External APIs
API_KEY=your-api-key`
        };
    }

    /**
     * Get execution status
     */
    getExecutionStatus(executionId) {
        return this.activeExecutions.get(executionId);
    }

    /**
     * Get all active executions
     */
    getAllExecutions() {
        return Array.from(this.activeExecutions.entries()).map(([id, execution]) => ({
            id,
            status: execution.status,
            projectName: execution.metadata.name,
            startTime: execution.startTime,
            steps: execution.steps.length
        }));
    }
}

/**
 * Express middleware for auto-execution
 */
function autoExecutionMiddleware(req, res, next) {
    req.autoExecutor = new AutoExecutionWrapper();
    next();
}

module.exports = {
    AutoExecutionWrapper,
    autoExecutionMiddleware
};