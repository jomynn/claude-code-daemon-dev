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

module.exports = router;