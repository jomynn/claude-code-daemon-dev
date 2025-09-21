/**
 * Project Management Routes
 * API endpoints for managing multiple Claude Code projects with BMAD integration
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const ClaudeCodeIntegration = require('../../utils/claude-code-integration');
const GitHubIntegration = require('../../utils/github-integration');

// Project storage - in production this would be in a database
let projects = new Map();

// Initialize integrations
const claudeIntegration = new ClaudeCodeIntegration();
const githubIntegration = new GitHubIntegration();

// Comprehensive BMAD-Method Roles
const BMAD_ROLES = {
    // Core Development Roles
    'senior-dev': {
        name: 'Senior Developer',
        description: 'Architecture and complex feature development',
        skills: ['system-design', 'advanced-programming', 'mentoring'],
        category: 'development'
    },
    'dev': {
        name: 'Developer',
        description: 'Feature implementation and bug fixes',
        skills: ['programming', 'debugging', 'code-review'],
        category: 'development'
    },
    'junior-dev': {
        name: 'Junior Developer',
        description: 'Simple features and learning tasks',
        skills: ['basic-programming', 'testing', 'documentation'],
        category: 'development'
    },
    'frontend-dev': {
        name: 'Frontend Developer',
        description: 'UI/UX implementation and client-side development',
        skills: ['html', 'css', 'javascript', 'react', 'vue', 'angular'],
        category: 'development'
    },
    'backend-dev': {
        name: 'Backend Developer',
        description: 'Server-side logic and API development',
        skills: ['api-design', 'databases', 'server-architecture'],
        category: 'development'
    },
    'fullstack-dev': {
        name: 'Fullstack Developer',
        description: 'Both frontend and backend development',
        skills: ['frontend', 'backend', 'integration'],
        category: 'development'
    },

    // Quality Assurance Roles
    'qa-lead': {
        name: 'QA Lead',
        description: 'Testing strategy and quality oversight',
        skills: ['test-strategy', 'automation', 'team-leadership'],
        category: 'quality'
    },
    'qa': {
        name: 'QA Engineer',
        description: 'Testing and quality assurance',
        skills: ['manual-testing', 'automation', 'bug-reporting'],
        category: 'quality'
    },
    'automation-qa': {
        name: 'Automation QA',
        description: 'Automated testing and CI/CD',
        skills: ['test-automation', 'selenium', 'cypress', 'jest'],
        category: 'quality'
    },
    'performance-qa': {
        name: 'Performance QA',
        description: 'Performance and load testing',
        skills: ['load-testing', 'performance-analysis', 'optimization'],
        category: 'quality'
    },

    // Management Roles
    'tech-lead': {
        name: 'Technical Lead',
        description: 'Technical direction and team guidance',
        skills: ['architecture', 'team-leadership', 'technical-decisions'],
        category: 'management'
    },
    'pm': {
        name: 'Project Manager',
        description: 'Project coordination and delivery',
        skills: ['project-planning', 'coordination', 'stakeholder-management'],
        category: 'management'
    },
    'product-manager': {
        name: 'Product Manager',
        description: 'Product strategy and requirements',
        skills: ['product-strategy', 'requirements', 'user-research'],
        category: 'management'
    },
    'scrum-master': {
        name: 'Scrum Master',
        description: 'Agile process facilitation',
        skills: ['agile', 'facilitation', 'team-coaching'],
        category: 'management'
    },

    // Specialized Roles
    'devops': {
        name: 'DevOps Engineer',
        description: 'Infrastructure and deployment automation',
        skills: ['ci-cd', 'infrastructure', 'monitoring', 'docker', 'kubernetes'],
        category: 'operations'
    },
    'security': {
        name: 'Security Engineer',
        description: 'Security assessment and implementation',
        skills: ['security-audit', 'penetration-testing', 'compliance'],
        category: 'security'
    },
    'data-engineer': {
        name: 'Data Engineer',
        description: 'Data pipeline and analytics',
        skills: ['data-processing', 'etl', 'analytics', 'databases'],
        category: 'data'
    },
    'ml-engineer': {
        name: 'ML Engineer',
        description: 'Machine learning implementation',
        skills: ['machine-learning', 'data-science', 'model-deployment'],
        category: 'data'
    },
    'mobile-dev': {
        name: 'Mobile Developer',
        description: 'Mobile application development',
        skills: ['ios', 'android', 'react-native', 'flutter'],
        category: 'development'
    },

    // Design and UX Roles
    'ux-designer': {
        name: 'UX Designer',
        description: 'User experience design and research',
        skills: ['user-research', 'wireframing', 'prototyping'],
        category: 'design'
    },
    'ui-designer': {
        name: 'UI Designer',
        description: 'User interface design and visual design',
        skills: ['visual-design', 'typography', 'color-theory'],
        category: 'design'
    },

    // Documentation and Support
    'tech-writer': {
        name: 'Technical Writer',
        description: 'Documentation and technical communication',
        skills: ['technical-writing', 'documentation', 'api-docs'],
        category: 'documentation'
    },
    'support': {
        name: 'Support Engineer',
        description: 'Customer support and issue resolution',
        skills: ['troubleshooting', 'customer-service', 'issue-tracking'],
        category: 'support'
    },

    // Business and Analysis
    'business-analyst': {
        name: 'Business Analyst',
        description: 'Requirements analysis and business logic',
        skills: ['requirements-analysis', 'business-process', 'stakeholder-communication'],
        category: 'analysis'
    },
    'data-analyst': {
        name: 'Data Analyst',
        description: 'Data analysis and reporting',
        skills: ['data-analysis', 'reporting', 'visualization'],
        category: 'analysis'
    }
};

// BMAD Workflow Templates
const BMAD_WORKFLOWS = {
    'agile': {
        name: 'Agile Development',
        phases: ['planning', 'development', 'testing', 'review', 'deployment'],
        recommendedRoles: ['pm', 'dev', 'qa', 'scrum-master']
    },
    'waterfall': {
        name: 'Waterfall',
        phases: ['requirements', 'design', 'implementation', 'testing', 'deployment'],
        recommendedRoles: ['pm', 'business-analyst', 'senior-dev', 'qa']
    },
    'startup': {
        name: 'Startup MVP',
        phases: ['prototype', 'mvp', 'iterate'],
        recommendedRoles: ['fullstack-dev', 'product-manager', 'ux-designer']
    },
    'enterprise': {
        name: 'Enterprise Development',
        phases: ['architecture', 'development', 'security-review', 'testing', 'deployment'],
        recommendedRoles: ['tech-lead', 'senior-dev', 'security', 'devops', 'qa-lead']
    },
    'maintenance': {
        name: 'Maintenance Mode',
        phases: ['support', 'bug-fixes', 'minor-updates'],
        recommendedRoles: ['dev', 'support', 'qa']
    }
};

// Helper function to get default BMAD config
function getDefaultBmadConfig(workflow = 'agile') {
    const workflowConfig = BMAD_WORKFLOWS[workflow] || BMAD_WORKFLOWS.agile;
    return {
        enabled: true,
        workflow: workflow,
        agents: workflowConfig.recommendedRoles,
        phases: workflowConfig.phases,
        currentPhase: workflowConfig.phases[0],
        roleAssignments: {},
        settings: {
            maxAgents: 10,
            allowCustomRoles: true,
            autoAdvancePhases: false
        }
    };
}

// Load projects from file on startup
const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');

async function loadProjects() {
    try {
        const data = await fs.readFile(PROJECTS_FILE, 'utf8');
        const projectsArray = JSON.parse(data);
        projects = new Map(projectsArray.map(p => [p.id, p]));
    } catch (error) {
        console.log('No existing projects file, starting fresh');
        projects = new Map();
    }
}

async function saveProjects() {
    try {
        await fs.mkdir(path.dirname(PROJECTS_FILE), { recursive: true });
        const projectsArray = Array.from(projects.values());
        await fs.writeFile(PROJECTS_FILE, JSON.stringify(projectsArray, null, 2));
    } catch (error) {
        console.error('Failed to save projects:', error);
    }
}

// Initialize projects on startup
loadProjects();

// Get all projects
router.get('/', async (req, res) => {
    try {
        const projectsArray = Array.from(projects.values());
        const projectList = await Promise.all(
            projectsArray.map(async (project) => ({
                ...project,
                // Add runtime status
                status: await getProjectStatus(project)
            }))
        );

        res.json({
            success: true,
            data: projectList,
            count: projectList.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get project statistics
router.get('/stats', async (req, res) => {
    try {
        const projectsArray = Array.from(projects.values());

        // Calculate statistics
        const totalProjects = projectsArray.length;
        const activeSessions = projectsArray.filter(p => p.status === 'running' || p.status === 'active').length;
        const githubRepos = projectsArray.filter(p => p.githubRepo).length;

        // Calculate success rate (projects that are not failed)
        const successfulProjects = projectsArray.filter(p => p.status !== 'failed' && p.status !== 'error').length;
        const successRate = totalProjects > 0 ? Math.round((successfulProjects / totalProjects) * 100) : 0;

        // Template distribution
        const templates = {};
        projectsArray.forEach(p => {
            const template = p.template || 'custom';
            templates[template] = (templates[template] || 0) + 1;
        });

        // BMAD enabled projects
        const bmadEnabled = projectsArray.filter(p => p.bmadConfig?.enabled).length;

        res.json({
            success: true,
            data: {
                totalProjects,
                activeSessions,
                githubRepos,
                successRate: `${successRate}%`,
                bmadEnabled,
                templates,
                recentActivity: projectsArray
                    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                    .slice(0, 5)
                    .map(p => ({
                        id: p.id,
                        name: p.name,
                        updatedAt: p.updatedAt,
                        status: p.status
                    }))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create new project
router.post('/', async (req, res) => {
    try {
        const {
            name,
            description,
            targetFolder,
            template,
            githubRepo,
            claudeConfig,
            bmadConfig,
            initGit,
            createReadme,
            createGitignore
        } = req.body;

        if (!name || !targetFolder) {
            return res.status(400).json({
                success: false,
                error: 'Project name and target folder are required'
            });
        }

        const projectId = generateProjectId();
        const project = {
            id: projectId,
            name,
            description: description || '',
            targetFolder: path.resolve(targetFolder),
            template: template || null,
            githubRepo: githubRepo || null,
            claudeConfig: claudeConfig || {
                enabled: true,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 4000,
                temperature: 0.7
            },
            bmadConfig: bmadConfig || getDefaultBmadConfig(bmadConfig?.workflow || 'agile'),
            settings: {
                initGit: initGit !== false, // Default true
                createReadme: createReadme !== false, // Default true
                createGitignore: createGitignore !== false // Default true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'creating'
        };

        // Create project directory if it doesn't exist
        await fs.mkdir(project.targetFolder, { recursive: true });

        // Initialize project template if specified
        if (template) {
            await initializeProjectTemplate(project, template);
        }

        // Initialize git repository
        if (project.settings.initGit || githubRepo) {
            const gitResult = await initializeGitRepo(project);
            if (!gitResult) {
                console.warn('Failed to initialize git repository');
            }
        }

        // Create standard project files
        await createProjectFiles(project);

        // Create project configuration files
        await createProjectConfig(project);

        // Update project status
        project.status = 'initialized';

        projects.set(projectId, project);
        await saveProjects();

        res.status(201).json({
            success: true,
            data: project,
            message: 'Project created successfully'
        });
    } catch (error) {
        console.error('Project creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific project
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = projects.get(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        // Add runtime information
        const projectWithStatus = {
            ...project,
            status: await getProjectStatus(project),
            stats: await getProjectStats(project)
        };

        res.json({
            success: true,
            data: projectWithStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update project
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = projects.get(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const updates = req.body;
        const updatedProject = {
            ...project,
            ...updates,
            id, // Prevent ID changes
            updatedAt: new Date().toISOString()
        };

        projects.set(id, updatedProject);
        await saveProjects();

        res.json({
            success: true,
            data: updatedProject,
            message: 'Project updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete project
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = projects.get(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const { removeFiles = false } = req.query;

        if (removeFiles === 'true') {
            // Remove project directory
            await fs.rmdir(project.targetFolder, { recursive: true });
        }

        projects.delete(id);
        await saveProjects();

        res.json({
            success: true,
            message: 'Project deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start Claude Code for project
router.post('/:id/start-claude', async (req, res) => {
    try {
        const { id } = req.params;
        const project = projects.get(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const result = await startClaudeCode(project);

        res.json({
            success: true,
            data: result,
            message: 'Claude Code started for project'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start BMAD workflow for project
router.post('/:id/start-bmad', async (req, res) => {
    try {
        const { id } = req.params;
        const { workflowType = 'development', agents } = req.body;
        const project = projects.get(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const result = await startBmadWorkflow(project, workflowType, agents);

        res.json({
            success: true,
            data: result,
            message: 'BMAD workflow started for project'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get project file structure
router.get('/:id/files', async (req, res) => {
    try {
        const { id } = req.params;
        const project = projects.get(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const fileStructure = await getFileStructure(project.targetFolder);

        res.json({
            success: true,
            data: fileStructure
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute command in project context
router.post('/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;
        const { command, args = [] } = req.body;
        const project = projects.get(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const result = await executeProjectCommand(project, command, args);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clone GitHub repository
router.post('/clone-github', async (req, res) => {
    try {
        const { repoUrl, targetFolder, projectName, projectDescription } = req.body;

        if (!repoUrl || !targetFolder) {
            return res.status(400).json({
                success: false,
                error: 'Repository URL and target folder are required'
            });
        }

        // Clone the repository
        const cloneResult = await githubIntegration.cloneRepository(repoUrl, targetFolder);

        if (!cloneResult.success) {
            return res.status(400).json({
                success: false,
                error: cloneResult.error
            });
        }

        // Create project from cloned repository
        const projectId = generateProjectId();
        const project = {
            id: projectId,
            name: projectName || cloneResult.repository.repo,
            description: projectDescription || `Cloned from ${repoUrl}`,
            targetFolder: path.resolve(targetFolder),
            githubRepo: repoUrl,
            claudeConfig: {
                enabled: true,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 4000,
                temperature: 0.7
            },
            bmadConfig: {
                enabled: true,
                agents: ['dev', 'qa'],
                workflow: 'standard'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'cloned'
        };

        projects.set(projectId, project);
        await saveProjects();

        res.status(201).json({
            success: true,
            data: project,
            cloneResult,
            message: 'Repository cloned and project created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create GitHub repository
router.post('/create-github-repo', async (req, res) => {
    try {
        const { repoName, description, isPrivate = false, projectId } = req.body;

        if (!repoName) {
            return res.status(400).json({
                success: false,
                error: 'Repository name is required'
            });
        }

        const result = await githubIntegration.createRepository(repoName, {
            description,
            private: isPrivate
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        // Update project with GitHub repository if projectId is provided
        if (projectId) {
            const project = projects.get(projectId);
            if (project) {
                project.githubRepo = result.repository.cloneUrl;
                project.updatedAt = new Date().toISOString();
                projects.set(projectId, project);
                await saveProjects();
            }
        }

        res.json({
            success: true,
            data: result.repository,
            message: 'GitHub repository created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send command to Claude Code
router.post('/:id/claude/command', async (req, res) => {
    try {
        const { id } = req.params;
        const { command } = req.body;

        if (!command) {
            return res.status(400).json({
                success: false,
                error: 'Command is required'
            });
        }

        const result = await claudeIntegration.sendCommand(id, command);

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop Claude Code for project
router.post('/:id/claude/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await claudeIntegration.stopClaudeCode(id);

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Claude Code processes status
router.get('/claude/status', async (req, res) => {
    try {
        const status = claudeIntegration.getProcessStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper functions
function generateProjectId() {
    return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function getProjectStatus(project) {
    try {
        // Check if directory exists
        await fs.access(project.targetFolder);

        // Check if git repo exists
        const gitDir = path.join(project.targetFolder, '.git');
        const hasGit = await fs.access(gitDir).then(() => true).catch(() => false);

        // Check for package.json or other project indicators
        const packageJson = path.join(project.targetFolder, 'package.json');
        const hasPackageJson = await fs.access(packageJson).then(() => true).catch(() => false);

        return {
            exists: true,
            hasGit,
            hasPackageJson,
            lastModified: (await fs.stat(project.targetFolder)).mtime
        };
    } catch (error) {
        return {
            exists: false,
            error: error.message
        };
    }
}

async function getProjectStats(project) {
    try {
        const stats = await fs.stat(project.targetFolder);

        // Count files recursively
        const fileCount = await countFiles(project.targetFolder);

        return {
            size: stats.size,
            fileCount,
            lastModified: stats.mtime
        };
    } catch (error) {
        return {
            error: error.message
        };
    }
}

async function countFiles(dir) {
    try {
        const files = await fs.readdir(dir);
        let count = 0;

        for (const file of files) {
            if (file.startsWith('.')) continue; // Skip hidden files

            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                count += await countFiles(filePath);
            } else {
                count++;
            }
        }

        return count;
    } catch (error) {
        return 0;
    }
}

async function initializeGitRepo(project) {
    try {
        process.chdir(project.targetFolder);

        // Initialize git repository
        execSync('git init', { cwd: project.targetFolder });

        // Set up remote if GitHub repo is specified
        if (project.githubRepo) {
            execSync(`git remote add origin ${project.githubRepo}`, { cwd: project.targetFolder });
        }

        return true;
    } catch (error) {
        console.error('Failed to initialize git repo:', error);
        return false;
    }
}

async function initializeProjectTemplate(project, template) {
    const templates = {
        'node-express': {
            files: {
                'package.json': {
                    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    version: '1.0.0',
                    description: project.description,
                    main: 'index.js',
                    scripts: {
                        start: 'node index.js',
                        dev: 'nodemon index.js',
                        test: 'jest'
                    },
                    dependencies: {
                        express: '^4.18.0',
                        cors: '^2.8.5',
                        helmet: '^6.0.0'
                    },
                    devDependencies: {
                        nodemon: '^2.0.20',
                        jest: '^29.0.0'
                    }
                },
                'index.js': `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to ${project.name}!' });
});

app.listen(port, () => {
    console.log(\`Server running on port \${port}\`);
});
`
            }
        },
        'react-app': {
            files: {
                'package.json': {
                    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    version: '1.0.0',
                    description: project.description,
                    scripts: {
                        start: 'react-scripts start',
                        build: 'react-scripts build',
                        test: 'react-scripts test',
                        eject: 'react-scripts eject'
                    },
                    dependencies: {
                        react: '^18.2.0',
                        'react-dom': '^18.2.0',
                        'react-scripts': '^5.0.1'
                    }
                },
                'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${project.name}</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>`,
                'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
`,
                'src/App.js': `import React from 'react';

function App() {
    return (
        <div>
            <h1>Welcome to ${project.name}</h1>
            <p>${project.description}</p>
        </div>
    );
}

export default App;
`
            }
        },
        'python-flask': {
            files: {
                'requirements.txt': `Flask==2.3.0
Flask-CORS==4.0.0
python-dotenv==1.0.0
`,
                'app.py': `from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def hello():
    return jsonify({'message': 'Welcome to ${project.name}!'})

if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))
`,
                '.env': 'FLASK_ENV=development\nPORT=5000\n'
            }
        },
        'static-html': {
            files: {
                'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>${project.name}</h1>
    </header>
    <main>
        <p>${project.description}</p>
    </main>
    <script src="script.js"></script>
</body>
</html>`,
                'styles.css': `/* ${project.name} Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
}

header {
    background: #007acc;
    color: white;
    text-align: center;
    padding: 1rem;
}

main {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1rem;
}
`,
                'script.js': `// ${project.name} JavaScript
console.log('Welcome to ${project.name}!');

document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded successfully');
});
`
            }
        },
        // BMAD Quick Start Templates
        'bmad-startup-mvp': {
            files: {
                'package.json': {
                    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    version: '1.0.0',
                    description: project.description,
                    scripts: {
                        start: 'react-scripts start',
                        build: 'react-scripts build',
                        test: 'react-scripts test',
                        dev: 'concurrently "npm run start" "npm run server"',
                        server: 'node server/index.js'
                    },
                    dependencies: {
                        react: '^18.2.0',
                        'react-dom': '^18.2.0',
                        'react-scripts': '^5.0.1',
                        axios: '^1.3.0',
                        'react-router-dom': '^6.8.0'
                    },
                    devDependencies: {
                        concurrently: '^7.6.0'
                    }
                },
                'BMAD_CONFIG.md': `# BMAD Configuration for ${project.name}

## Project Type: Startup MVP
**Workflow**: Lean Development
**Timeline**: 2-4 weeks

## Agents Configuration
- **dev**: Full-stack development
- **design**: UI/UX design and prototyping
- **product**: Product management and validation

## BMAD Workflow Phases
1. **Prototype**: Quick proof of concept
2. **MVP**: Minimum viable product
3. **Iterate**: User feedback and improvements

## Key Features
- React/Vue Frontend
- Node.js Backend
- User Authentication
- Basic Analytics

## Development Strategy
Focus on rapid prototyping and quick iterations. Prioritize user feedback and market validation.
`,
                'src/App.js': `import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
    return (
        <Router>
            <div className="App">
                <header>
                    <h1>${project.name}</h1>
                    <p>Startup MVP - Built with BMAD</p>
                </header>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                </Routes>
            </div>
        </Router>
    );
}

function Home() {
    return (
        <div className="home">
            <h2>Welcome to ${project.name}</h2>
            <p>${project.description}</p>
            <button onClick={() => window.location.href = '/dashboard'}>
                Get Started
            </button>
        </div>
    );
}

function Dashboard() {
    return (
        <div className="dashboard">
            <h2>Dashboard</h2>
            <p>Your MVP dashboard is ready for development!</p>
        </div>
    );
}

export default App;
`,
                'server/index.js': `const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MVP API endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: 'MVP Server Running',
        project: '${project.name}',
        version: '1.0.0'
    });
});

app.listen(port, () => {
    console.log(\`MVP Server running on port \${port}\`);
});
`
            }
        },
        'bmad-enterprise': {
            files: {
                'package.json': {
                    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    version: '1.0.0',
                    description: project.description,
                    scripts: {
                        start: 'node dist/index.js',
                        dev: 'nodemon src/index.ts',
                        build: 'tsc',
                        test: 'jest',
                        'test:coverage': 'jest --coverage',
                        lint: 'eslint src/**/*.ts'
                    },
                    dependencies: {
                        express: '^4.18.0',
                        typescript: '^4.9.0',
                        helmet: '^6.0.0',
                        cors: '^2.8.5',
                        jsonwebtoken: '^9.0.0',
                        bcryptjs: '^2.4.3'
                    },
                    devDependencies: {
                        '@types/node': '^18.0.0',
                        '@types/express': '^4.17.0',
                        nodemon: '^2.0.20',
                        jest: '^29.0.0',
                        eslint: '^8.0.0'
                    }
                },
                'BMAD_CONFIG.md': `# BMAD Configuration for ${project.name}

## Project Type: Enterprise Application
**Workflow**: Waterfall with Security Focus
**Timeline**: 8-12 weeks

## Agents Configuration
- **dev**: Senior development team
- **architect**: System architecture and design
- **security**: Security review and compliance
- **qa**: Quality assurance and testing

## BMAD Workflow Phases
1. **Architecture**: System design and planning
2. **Development**: Implementation with security focus
3. **Security Review**: Comprehensive security audit
4. **Testing**: Full QA and performance testing
5. **Deployment**: Production deployment and monitoring

## Key Features
- Microservices Architecture
- Database Design
- Security Framework
- Testing Suite

## Development Strategy
Enterprise-grade development with emphasis on security, scalability, and maintainability.
`,
                'src/index.ts': `import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// Enterprise security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: '${project.name}',
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use('/api/v1', require('./routes'));

app.listen(port, () => {
    console.log(\`Enterprise server running on port \${port}\`);
});
`,
                'tsconfig.json': {
                    compilerOptions: {
                        target: 'ES2020',
                        module: 'commonjs',
                        outDir: './dist',
                        rootDir: './src',
                        strict: true,
                        esModuleInterop: true,
                        skipLibCheck: true,
                        forceConsistentCasingInFileNames: true
                    },
                    include: ['src/**/*'],
                    exclude: ['node_modules', 'dist']
                }
            }
        },
        'bmad-agile-team': {
            files: {
                'package.json': {
                    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    version: '1.0.0',
                    description: project.description,
                    scripts: {
                        start: 'react-scripts start',
                        build: 'react-scripts build',
                        test: 'react-scripts test',
                        lint: 'eslint src/',
                        'test:ci': 'CI=true npm test -- --coverage --watchAll=false'
                    },
                    dependencies: {
                        react: '^18.2.0',
                        'react-dom': '^18.2.0',
                        'react-scripts': '^5.0.1',
                        '@testing-library/react': '^13.4.0',
                        '@testing-library/jest-dom': '^5.16.0'
                    }
                },
                'BMAD_CONFIG.md': `# BMAD Configuration for ${project.name}

## Project Type: Agile Development Team
**Workflow**: Agile/Scrum
**Timeline**: 6-8 weeks

## Agents Configuration
- **dev**: Development team
- **scrum-master**: Sprint management and facilitation
- **product-owner**: Requirements and prioritization
- **qa**: Quality assurance and testing

## BMAD Workflow Phases
1. **Sprint Planning**: Define sprint goals and tasks
2. **Development**: Implementation with daily standups
3. **Code Review**: Peer review and collaboration
4. **Testing**: Continuous testing and QA
5. **Sprint Review**: Demo and retrospective

## Key Features
- Sprint Planning
- Continuous Integration
- Code Reviews
- Daily Standups

## Development Strategy
Agile methodology with 2-week sprints, daily standups, and continuous integration.
`,
                'SPRINT_PLAN.md': `# Sprint Planning for ${project.name}

## Sprint 1 (Weeks 1-2)
- [ ] Project setup and configuration
- [ ] Basic component structure
- [ ] Initial UI design
- [ ] Unit test setup

## Sprint 2 (Weeks 3-4)
- [ ] Core feature implementation
- [ ] API integration
- [ ] Component testing
- [ ] Code review process

## Sprint 3 (Weeks 5-6)
- [ ] Feature refinement
- [ ] Performance optimization
- [ ] Integration testing
- [ ] Documentation

## Daily Standup Questions
1. What did I accomplish yesterday?
2. What will I work on today?
3. Are there any impediments in my way?

## Definition of Done
- [ ] Code is written and tested
- [ ] Code review is completed
- [ ] Documentation is updated
- [ ] Acceptance criteria are met
`,
                'src/components/Dashboard.js': `import React, { useState, useEffect } from 'react';

function Dashboard() {
    const [sprintData, setSprintData] = useState({
        currentSprint: 1,
        tasksCompleted: 0,
        totalTasks: 0,
        burndownRate: 0
    });

    useEffect(() => {
        // Fetch sprint data
        // This would connect to your project management API
    }, []);

    return (
        <div className="agile-dashboard">
            <h2>Agile Dashboard - ${project.name}</h2>
            <div className="sprint-info">
                <h3>Sprint {sprintData.currentSprint}</h3>
                <p>Tasks: {sprintData.tasksCompleted}/{sprintData.totalTasks}</p>
                <p>Burndown Rate: {sprintData.burndownRate}%</p>
            </div>
            <div className="team-velocity">
                <h4>Team Velocity</h4>
                {/* Sprint velocity chart would go here */}
            </div>
        </div>
    );
}

export default Dashboard;
`
            }
        },
        'bmad-data-science': {
            files: {
                'requirements.txt': `# ${project.name} - Data Science Dependencies
pandas>=1.5.0
numpy>=1.24.0
scikit-learn>=1.2.0
matplotlib>=3.6.0
seaborn>=0.12.0
jupyter>=1.0.0
jupyterlab>=3.5.0
flask>=2.2.0
requests>=2.28.0
python-dotenv>=0.19.0
`,
                'BMAD_CONFIG.md': `# BMAD Configuration for ${project.name}

## Project Type: Data Science Project
**Workflow**: Experimental with Model Development
**Timeline**: 4-6 weeks

## Agents Configuration
- **data-scientist**: Data analysis and model development
- **ml-engineer**: Model training and optimization
- **dev**: API development and deployment

## BMAD Workflow Phases
1. **Data Exploration**: Understanding the dataset
2. **Feature Engineering**: Data preprocessing and feature creation
3. **Model Development**: Training and validation
4. **Model Optimization**: Hyperparameter tuning
5. **Deployment**: API development and model serving

## Key Features
- Data Pipeline
- Model Training
- API Development
- Visualization Dashboard

## Development Strategy
Iterative experimentation with data-driven decisions and model validation.
`,
                'src/data_pipeline.py': `"""
Data Pipeline for ${project.name}
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import seaborn as sns

class DataPipeline:
    def __init__(self, data_path=None):
        self.data_path = data_path
        self.data = None
        self.scaler = StandardScaler()

    def load_data(self, path=None):
        """Load data from file"""
        path = path or self.data_path
        if path:
            if path.endswith('.csv'):
                self.data = pd.read_csv(path)
            elif path.endswith('.json'):
                self.data = pd.read_json(path)
        return self.data

    def explore_data(self):
        """Basic data exploration"""
        if self.data is not None:
            print(f"Dataset shape: {self.data.shape}")
            print(f"\\nData types:\\n{self.data.dtypes}")
            print(f"\\nMissing values:\\n{self.data.isnull().sum()}")
            return self.data.describe()

    def preprocess(self, target_column=None):
        """Preprocess data for modeling"""
        if self.data is None:
            raise ValueError("No data loaded")

        # Handle missing values
        self.data = self.data.fillna(self.data.mean(numeric_only=True))

        # Feature scaling
        numeric_columns = self.data.select_dtypes(include=[np.number]).columns
        if target_column and target_column in numeric_columns:
            numeric_columns = numeric_columns.drop(target_column)

        self.data[numeric_columns] = self.scaler.fit_transform(self.data[numeric_columns])

        return self.data

if __name__ == "__main__":
    pipeline = DataPipeline()
    print("Data pipeline for ${project.name} initialized")
`,
                'src/model.py': `"""
ML Model for ${project.name}
"""

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.metrics import classification_report, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score
import joblib
import numpy as np

class MLModel:
    def __init__(self, problem_type='classification'):
        self.problem_type = problem_type
        self.model = None
        self.is_trained = False

        if problem_type == 'classification':
            self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        else:
            self.model = RandomForestRegressor(n_estimators=100, random_state=42)

    def train(self, X_train, y_train):
        """Train the model"""
        self.model.fit(X_train, y_train)
        self.is_trained = True
        return self.model

    def predict(self, X_test):
        """Make predictions"""
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        return self.model.predict(X_test)

    def evaluate(self, X_test, y_test):
        """Evaluate model performance"""
        predictions = self.predict(X_test)

        if self.problem_type == 'classification':
            return classification_report(y_test, predictions)
        else:
            mse = mean_squared_error(y_test, predictions)
            r2 = r2_score(y_test, predictions)
            return {'mse': mse, 'r2': r2}

    def cross_validate(self, X, y, cv=5):
        """Perform cross validation"""
        scores = cross_val_score(self.model, X, y, cv=cv)
        return {'mean': scores.mean(), 'std': scores.std()}

    def save_model(self, filepath):
        """Save trained model"""
        if self.is_trained:
            joblib.dump(self.model, filepath)

    def load_model(self, filepath):
        """Load trained model"""
        self.model = joblib.load(filepath)
        self.is_trained = True

if __name__ == "__main__":
    model = MLModel()
    print("ML Model for ${project.name} initialized")
`,
                'app.py': `"""
Flask API for ${project.name}
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from src.model import MLModel
from src.data_pipeline import DataPipeline

app = Flask(__name__)
CORS(app)

# Initialize model and pipeline
model = MLModel()
pipeline = DataPipeline()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'project': '${project.name}',
        'type': 'Data Science API'
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json

        # Convert to DataFrame
        df = pd.DataFrame([data])

        # Preprocess
        processed_data = pipeline.preprocess()

        # Make prediction
        prediction = model.predict(processed_data)

        return jsonify({
            'prediction': prediction.tolist(),
            'status': 'success'
        })

    except Exception as e:
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 400

@app.route('/model/info', methods=['GET'])
def model_info():
    return jsonify({
        'model_type': model.problem_type,
        'is_trained': model.is_trained,
        'project': '${project.name}'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
`
            }
        },
        'bmad-maintenance': {
            files: {
                'package.json': {
                    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    version: '1.0.0',
                    description: project.description,
                    scripts: {
                        start: 'node index.js',
                        dev: 'nodemon index.js',
                        test: 'jest',
                        lint: 'eslint .',
                        'test:watch': 'jest --watch',
                        monitor: 'pm2 start ecosystem.config.js'
                    },
                    dependencies: {
                        express: '^4.18.0',
                        winston: '^3.8.0',
                        helmet: '^6.0.0',
                        pm2: '^5.2.0'
                    },
                    devDependencies: {
                        nodemon: '^2.0.20',
                        jest: '^29.0.0',
                        eslint: '^8.0.0'
                    }
                },
                'BMAD_CONFIG.md': `# BMAD Configuration for ${project.name}

## Project Type: Maintenance & Support
**Workflow**: Support and Bug Tracking
**Timeline**: Ongoing

## Agents Configuration
- **dev**: Development and bug fixes
- **support**: User support and issue triage
- **qa**: Quality assurance and regression testing

## BMAD Workflow Phases
1. **Issue Triage**: Categorize and prioritize issues
2. **Investigation**: Root cause analysis
3. **Fix Implementation**: Code changes and patches
4. **Testing**: Regression and validation testing
5. **Deployment**: Hotfix deployment and monitoring

## Key Features
- Bug Tracking
- Performance Monitoring
- Code Refactoring
- Documentation

## Development Strategy
Proactive maintenance with continuous monitoring and rapid issue resolution.
`,
                'MAINTENANCE_LOG.md': `# Maintenance Log for ${project.name}

## Issue Tracking Template

### High Priority Issues
- [ ] Critical bug fixes
- [ ] Security vulnerabilities
- [ ] Performance bottlenecks

### Medium Priority Issues
- [ ] Feature enhancements
- [ ] Code refactoring
- [ ] Documentation updates

### Low Priority Issues
- [ ] Minor bug fixes
- [ ] Code cleanup
- [ ] Optimization improvements

## Monitoring Checklist
- [ ] Server uptime
- [ ] Response times
- [ ] Error rates
- [ ] Memory usage
- [ ] Disk space
- [ ] Database performance

## Maintenance Schedule
- **Daily**: Health checks and monitoring
- **Weekly**: Performance review and optimization
- **Monthly**: Security updates and patches
- **Quarterly**: Code review and refactoring
`,
                'monitoring/health-check.js': `/**
 * Health Check Module for ${project.name}
 */

const os = require('os');
const fs = require('fs');

class HealthMonitor {
    constructor() {
        this.checks = {
            memory: this.checkMemory.bind(this),
            disk: this.checkDisk.bind(this),
            uptime: this.checkUptime.bind(this),
            load: this.checkLoad.bind(this)
        };
    }

    async runAllChecks() {
        const results = {};

        for (const [name, check] of Object.entries(this.checks)) {
            try {
                results[name] = await check();
            } catch (error) {
                results[name] = {
                    status: 'error',
                    error: error.message
                };
            }
        }

        return {
            timestamp: new Date().toISOString(),
            project: '${project.name}',
            overall: this.calculateOverallHealth(results),
            checks: results
        };
    }

    checkMemory() {
        const free = os.freemem();
        const total = os.totalmem();
        const used = total - free;
        const usagePercent = (used / total) * 100;

        return {
            status: usagePercent > 90 ? 'critical' : usagePercent > 70 ? 'warning' : 'healthy',
            usage: Math.round(usagePercent),
            free: Math.round(free / 1024 / 1024),
            total: Math.round(total / 1024 / 1024)
        };
    }

    checkDisk() {
        // Simplified disk check
        return {
            status: 'healthy',
            message: 'Disk check requires platform-specific implementation'
        };
    }

    checkUptime() {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);

        return {
            status: 'healthy',
            uptime: hours,
            started: new Date(Date.now() - uptime * 1000).toISOString()
        };
    }

    checkLoad() {
        const load = os.loadavg();
        const cpus = os.cpus().length;
        const loadPercent = (load[0] / cpus) * 100;

        return {
            status: loadPercent > 80 ? 'warning' : 'healthy',
            load: load[0],
            cpus: cpus,
            percent: Math.round(loadPercent)
        };
    }

    calculateOverallHealth(results) {
        const statuses = Object.values(results).map(r => r.status);

        if (statuses.includes('critical')) return 'critical';
        if (statuses.includes('warning')) return 'warning';
        if (statuses.includes('error')) return 'degraded';
        return 'healthy';
    }
}

module.exports = HealthMonitor;
`,
                'ecosystem.config.js': `module.exports = {
    apps: [{
        name: '${project.name}',
        script: './index.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'development',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true,
        max_memory_restart: '1G',
        node_args: '--max_old_space_size=1024'
    }]
};
`
            }
        },
        'bmad-custom': {
            files: {
                'package.json': {
                    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    version: '1.0.0',
                    description: project.description,
                    scripts: {
                        start: 'node index.js',
                        dev: 'nodemon index.js',
                        test: 'jest'
                    },
                    dependencies: {
                        express: '^4.18.0'
                    },
                    devDependencies: {
                        nodemon: '^2.0.20',
                        jest: '^29.0.0'
                    }
                },
                'BMAD_CONFIG.md': `# BMAD Configuration for ${project.name}

## Project Type: Custom Setup
**Workflow**: Custom Configuration
**Timeline**: Variable

## Agents Configuration
- **dev**: Development (customize as needed)

## BMAD Workflow Phases
1. **Planning**: Define custom workflow
2. **Setup**: Configure tools and processes
3. **Implementation**: Custom development approach
4. **Review**: Evaluate and adjust

## Key Features
- Custom Configuration
- Agent Selection
- Workflow Design

## Development Strategy
Flexible approach allowing full customization of BMAD workflow and agent configuration.
`,
                'CUSTOM_SETUP.md': `# Custom BMAD Setup for ${project.name}

## Configuration Options

### Available Agents
- **dev**: Development and coding
- **design**: UI/UX design
- **product**: Product management
- **qa**: Quality assurance
- **devops**: Operations and deployment
- **security**: Security review
- **architect**: System architecture
- **data-scientist**: Data analysis
- **ml-engineer**: Machine learning
- **support**: User support

### Workflow Templates
- **agile**: Scrum methodology
- **waterfall**: Traditional waterfall
- **lean**: Lean startup approach
- **experimental**: Research and experimentation
- **support**: Maintenance and support

### Customization Guide
1. Edit BMAD_CONFIG.md to define your workflow
2. Add/remove agents based on project needs
3. Customize phases and milestones
4. Set up project-specific tools and processes

## Getting Started
1. Review the configuration options above
2. Modify the workflow to match your needs
3. Add custom agents or phases as required
4. Document your custom process
`,
                'index.js': `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to ${project.name}',
        type: 'Custom BMAD Project',
        description: '${project.description}'
    });
});

app.get('/bmad/config', (req, res) => {
    res.json({
        project: '${project.name}',
        workflow: 'custom',
        agents: ['dev'], // Customize this array
        phases: ['planning', 'setup', 'implementation', 'review'],
        customizable: true
    });
});

app.listen(port, () => {
    console.log(\`Custom BMAD project running on port \${port}\`);
});
`
            }
        }
    };

    const templateConfig = templates[template];
    if (!templateConfig) {
        throw new Error(`Unknown template: ${template}`);
    }

    // Create template files
    for (const [filePath, content] of Object.entries(templateConfig.files)) {
        const fullPath = path.join(project.targetFolder, filePath);
        const dir = path.dirname(fullPath);

        // Create directory if it doesn't exist
        await fs.mkdir(dir, { recursive: true });

        // Write file content
        if (typeof content === 'object') {
            await fs.writeFile(fullPath, JSON.stringify(content, null, 2));
        } else {
            await fs.writeFile(fullPath, content);
        }
    }
}

async function createProjectFiles(project) {
    try {
        // Create README.md if requested
        if (project.settings.createReadme) {
            const readmeContent = `# ${project.name}

${project.description}

## Getting Started

This project was created with Claude Code Daemon.

### Prerequisites

- Node.js (if using Node.js template)
- Python (if using Python template)

### Installation

1. Clone the repository
2. Install dependencies
3. Start the development server

## Configuration

This project includes:
- ${project.claudeConfig.enabled ? '✅ Claude Code Assistant' : '❌ Claude Code Assistant'}
- ${project.bmadConfig.enabled ? '✅ BMAD Multi-Agent Development' : '❌ BMAD Multi-Agent Development'}

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License.
`;
            await fs.writeFile(path.join(project.targetFolder, 'README.md'), readmeContent);
        }

        // Create .gitignore if requested
        if (project.settings.createGitignore) {
            const gitignoreContent = `# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
env/

# Build outputs
dist/
build/
*.egg-info/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Claude Code Daemon
.claude-daemon/
*.claude-session
`;
            await fs.writeFile(path.join(project.targetFolder, '.gitignore'), gitignoreContent);
        }

        return true;
    } catch (error) {
        console.error('Failed to create project files:', error);
        return false;
    }
}

async function createProjectConfig(project) {
    try {
        const configDir = path.join(project.targetFolder, '.claude-daemon');
        await fs.mkdir(configDir, { recursive: true });

        const config = {
            projectId: project.id,
            claudeConfig: project.claudeConfig,
            bmadConfig: project.bmadConfig,
            createdAt: project.createdAt
        };

        await fs.writeFile(
            path.join(configDir, 'project.json'),
            JSON.stringify(config, null, 2)
        );

        return true;
    } catch (error) {
        console.error('Failed to create project config:', error);
        return false;
    }
}

async function startClaudeCode(project) {
    try {
        // Use the Claude Code integration
        const result = await claudeIntegration.startClaudeCode(project);

        if (!result.success) {
            throw new Error(result.error);
        }

        return result;
    } catch (error) {
        throw new Error(`Failed to start Claude Code: ${error.message}`);
    }
}

async function startBmadWorkflow(project, workflowType, agents) {
    try {
        const workflowId = `bmad-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        const workflow = {
            id: workflowId,
            projectId: project.id,
            type: workflowType,
            agents: agents || project.bmadConfig.agents,
            status: 'running',
            startedAt: new Date().toISOString(),
            steps: [
                {
                    id: 1,
                    name: 'initialization',
                    status: 'completed',
                    agent: 'system',
                    result: 'Workflow initialized'
                }
            ]
        };

        // Store workflow (in production, this would be in database)
        // For now, we'll return the workflow object

        return workflow;
    } catch (error) {
        throw new Error(`Failed to start BMAD workflow: ${error.message}`);
    }
}

async function getFileStructure(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return null;

    try {
        const items = await fs.readdir(dir);
        const structure = {
            name: path.basename(dir),
            type: 'directory',
            path: dir,
            children: []
        };

        for (const item of items) {
            if (item.startsWith('.') && item !== '.claude-daemon') continue;

            const itemPath = path.join(dir, item);
            const stat = await fs.stat(itemPath);

            if (stat.isDirectory()) {
                const subStructure = await getFileStructure(itemPath, depth + 1, maxDepth);
                if (subStructure) {
                    structure.children.push(subStructure);
                }
            } else {
                structure.children.push({
                    name: item,
                    type: 'file',
                    path: itemPath,
                    size: stat.size,
                    modified: stat.mtime
                });
            }
        }

        return structure;
    } catch (error) {
        return {
            name: path.basename(dir),
            type: 'directory',
            path: dir,
            error: error.message
        };
    }
}

async function executeProjectCommand(project, command, args) {
    try {
        const fullCommand = `${command} ${args.join(' ')}`;
        const output = execSync(fullCommand, {
            cwd: project.targetFolder,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 // 1MB buffer
        });

        return {
            command: fullCommand,
            output,
            exitCode: 0,
            executedAt: new Date().toISOString()
        };
    } catch (error) {
        return {
            command: `${command} ${args.join(' ')}`,
            output: error.stdout || '',
            error: error.stderr || error.message,
            exitCode: error.status || 1,
            executedAt: new Date().toISOString()
        };
    }
}

// Get BMAD roles and workflows
router.get('/bmad/roles', (req, res) => {
    res.json({
        success: true,
        data: {
            roles: BMAD_ROLES,
            categories: Object.keys(BMAD_ROLES).reduce((acc, key) => {
                const category = BMAD_ROLES[key].category;
                if (!acc[category]) acc[category] = [];
                acc[category].push(key);
                return acc;
            }, {})
        }
    });
});

router.get('/bmad/workflows', (req, res) => {
    res.json({
        success: true,
        data: BMAD_WORKFLOWS
    });
});

// Get specific project's BMAD configuration
router.get('/:id/bmad', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        res.json({
            success: true,
            data: {
                config: project.bmadConfig,
                availableRoles: BMAD_ROLES,
                availableWorkflows: BMAD_WORKFLOWS,
                roleDetails: project.bmadConfig.agents.map(agentKey => ({
                    key: agentKey,
                    ...BMAD_ROLES[agentKey]
                }))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update project's BMAD configuration
router.put('/:id/bmad', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const { workflow, agents, phases, currentPhase, settings } = req.body;

        // Update BMAD configuration
        project.bmadConfig = {
            ...project.bmadConfig,
            ...(workflow && { workflow }),
            ...(agents && { agents }),
            ...(phases && { phases }),
            ...(currentPhase && { currentPhase }),
            ...(settings && { settings: { ...project.bmadConfig.settings, ...settings } })
        };

        project.updatedAt = new Date().toISOString();
        await saveProjects();

        res.json({
            success: true,
            data: project.bmadConfig,
            message: 'BMAD configuration updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Terminal Interface for Claude Code
router.post('/:id/terminal/create', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        // Create a new terminal session
        const terminalId = `terminal-${project.id}-${Date.now()}`;
        const terminalProcess = spawn('bash', ['-l'], {
            cwd: project.targetFolder,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                PS1: '\\u@\\h:\\w$ ',
                CLAUDE_PROJECT_ID: project.id,
                CLAUDE_PROJECT_NAME: project.name
            }
        });

        // Set up real-time output streaming
        terminalProcess.stdout.on('data', (data) => {
            const output = data.toString();
            // Emit to all connected clients
            if (global.io) {
                global.io.emit('terminal-output', {
                    terminalId,
                    projectId: project.id,
                    output,
                    type: 'stdout',
                    timestamp: new Date().toISOString()
                });
            }
        });

        terminalProcess.stderr.on('data', (data) => {
            const output = data.toString();
            if (global.io) {
                global.io.emit('terminal-output', {
                    terminalId,
                    projectId: project.id,
                    output,
                    type: 'stderr',
                    timestamp: new Date().toISOString()
                });
            }
        });

        terminalProcess.on('close', (code) => {
            if (global.io) {
                global.io.emit('terminal-closed', {
                    terminalId,
                    projectId: project.id,
                    exitCode: code,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Store terminal session
        if (!project.terminalSessions) {
            project.terminalSessions = new Map();
        }
        project.terminalSessions.set(terminalId, {
            process: terminalProcess,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        });

        res.json({
            success: true,
            data: {
                terminalId,
                pid: terminalProcess.pid,
                cwd: project.targetFolder,
                createdAt: new Date().toISOString()
            },
            message: 'Terminal session created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send command to terminal
router.post('/:id/terminal/:terminalId/command', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project || !project.terminalSessions) {
            return res.status(404).json({
                success: false,
                error: 'Project or terminal session not found'
            });
        }

        const terminalSession = project.terminalSessions.get(req.params.terminalId);
        if (!terminalSession) {
            return res.status(404).json({
                success: false,
                error: 'Terminal session not found'
            });
        }

        const { command } = req.body;
        if (!command) {
            return res.status(400).json({
                success: false,
                error: 'Command is required'
            });
        }

        // Send command to terminal
        terminalSession.process.stdin.write(command + '\n');
        terminalSession.lastActivity = new Date().toISOString();

        res.json({
            success: true,
            message: 'Command sent to terminal'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get terminal output
router.get('/:id/terminal/:terminalId/output', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project || !project.terminalSessions) {
            return res.status(404).json({
                success: false,
                error: 'Project or terminal session not found'
            });
        }

        const terminalSession = project.terminalSessions.get(req.params.terminalId);
        if (!terminalSession) {
            return res.status(404).json({
                success: false,
                error: 'Terminal session not found'
            });
        }

        // For real-time output, you would typically use WebSockets
        // This is a simplified version that returns session info
        res.json({
            success: true,
            data: {
                terminalId: req.params.terminalId,
                pid: terminalSession.process.pid,
                createdAt: terminalSession.createdAt,
                lastActivity: terminalSession.lastActivity,
                status: terminalSession.process.killed ? 'terminated' : 'running'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List terminal sessions
router.get('/:id/terminal/sessions', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const sessions = [];
        if (project.terminalSessions) {
            for (const [terminalId, session] of project.terminalSessions) {
                sessions.push({
                    terminalId,
                    pid: session.process.pid,
                    createdAt: session.createdAt,
                    lastActivity: session.lastActivity,
                    status: session.process.killed ? 'terminated' : 'running'
                });
            }
        }

        res.json({
            success: true,
            data: sessions,
            count: sessions.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Terminate terminal session
router.delete('/:id/terminal/:terminalId', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project || !project.terminalSessions) {
            return res.status(404).json({
                success: false,
                error: 'Project or terminal session not found'
            });
        }

        const terminalSession = project.terminalSessions.get(req.params.terminalId);
        if (!terminalSession) {
            return res.status(404).json({
                success: false,
                error: 'Terminal session not found'
            });
        }

        // Terminate the process
        terminalSession.process.kill('SIGTERM');

        // Remove from sessions
        project.terminalSessions.delete(req.params.terminalId);

        res.json({
            success: true,
            message: 'Terminal session terminated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Read file content
router.post('/:id/files/read', async (req, res) => {
    try {
        const project = projects.get(req.params.id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const { filePath } = req.body;
        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'File path is required'
            });
        }

        // Security check - ensure file is within project directory
        const absoluteFilePath = path.resolve(project.targetFolder, filePath.replace(project.targetFolder, ''));
        if (!absoluteFilePath.startsWith(path.resolve(project.targetFolder))) {
            return res.status(403).json({
                success: false,
                error: 'Access denied - file outside project directory'
            });
        }

        try {
            const content = await fs.readFile(absoluteFilePath, 'utf8');
            res.json({
                success: true,
                data: {
                    content,
                    path: filePath,
                    size: content.length
                }
            });
        } catch (fileError) {
            if (fileError.code === 'ENOENT') {
                return res.status(404).json({
                    success: false,
                    error: 'File not found'
                });
            }
            throw fileError;
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start BMAD workflow for project
router.post('/:id/bmad/start', async (req, res) => {
    try {
        const { id } = req.params;
        const { workflow, agents, template } = req.body;

        const project = projects.get(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        // Update project with BMAD configuration if provided
        if (workflow || agents || template) {
            project.bmadConfig = {
                ...project.bmadConfig,
                workflow: workflow || project.bmadConfig.workflow,
                agents: agents || project.bmadConfig.agents,
                template: template || project.bmadConfig.template,
                enabled: true,
                startedAt: new Date().toISOString(),
                status: 'running'
            };

            // Update project in storage
            projects.set(id, project);
            await saveProjects();
        }

        // Initialize BMAD workflow based on template
        const bmadResult = await initializeBmadWorkflow(project);

        // Broadcast BMAD event through WebSocket if available
        if (global.io) {
            global.io.to('bmad').emit('bmad-workflow-started', {
                projectId: id,
                projectName: project.name,
                workflow: project.bmadConfig.workflow,
                agents: project.bmadConfig.agents,
                template: project.bmadConfig.template
            });
        }

        res.json({
            success: true,
            data: {
                project: project,
                bmadResult: bmadResult
            },
            message: 'BMAD workflow started successfully'
        });

    } catch (error) {
        console.error('BMAD workflow start error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to initialize BMAD workflow
async function initializeBmadWorkflow(project) {
    const { bmadConfig } = project;

    if (!bmadConfig || !bmadConfig.enabled) {
        throw new Error('BMAD configuration not found or disabled');
    }

    const workflowResult = {
        projectId: project.id,
        workflow: bmadConfig.workflow,
        agents: bmadConfig.agents,
        template: bmadConfig.template,
        status: 'initialized',
        phases: [],
        currentPhase: null
    };

    // Initialize phases based on workflow type
    switch (bmadConfig.workflow) {
        case 'lean':
            workflowResult.phases = ['prototype', 'mvp', 'iterate'];
            workflowResult.currentPhase = 'prototype';
            break;
        case 'waterfall':
            workflowResult.phases = ['architecture', 'development', 'security-review', 'testing', 'deployment'];
            workflowResult.currentPhase = 'architecture';
            break;
        case 'agile':
            workflowResult.phases = ['sprint-planning', 'development', 'code-review', 'testing', 'sprint-review'];
            workflowResult.currentPhase = 'sprint-planning';
            break;
        case 'experimental':
            workflowResult.phases = ['data-exploration', 'feature-engineering', 'model-development', 'optimization', 'deployment'];
            workflowResult.currentPhase = 'data-exploration';
            break;
        case 'support':
            workflowResult.phases = ['issue-triage', 'investigation', 'fix-implementation', 'testing', 'deployment'];
            workflowResult.currentPhase = 'issue-triage';
            break;
        case 'custom':
            workflowResult.phases = ['planning', 'setup', 'implementation', 'review'];
            workflowResult.currentPhase = 'planning';
            break;
        default:
            workflowResult.phases = ['planning', 'development', 'testing', 'deployment'];
            workflowResult.currentPhase = 'planning';
    }

    // Initialize agent configurations
    workflowResult.agentConfigs = bmadConfig.agents.map(agentType => ({
        type: agentType,
        status: 'active',
        tasks: [],
        startedAt: new Date().toISOString()
    }));

    return workflowResult;
}

module.exports = router;