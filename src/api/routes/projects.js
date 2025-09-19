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
        const { name, description, targetFolder, githubRepo, claudeConfig, bmadConfig } = req.body;

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
            githubRepo: githubRepo || null,
            claudeConfig: claudeConfig || {
                enabled: true,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 4000,
                temperature: 0.7
            },
            bmadConfig: bmadConfig || {
                enabled: true,
                agents: ['dev', 'qa', 'pm'],
                workflow: 'standard'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'initialized'
        };

        // Create project directory if it doesn't exist
        await fs.mkdir(project.targetFolder, { recursive: true });

        // Initialize git repository if GitHub repo is specified
        if (githubRepo) {
            const gitResult = await initializeGitRepo(project);
            if (!gitResult) {
                console.warn('Failed to initialize git repository');
            }
        }

        // Create project configuration files
        await createProjectConfig(project);

        projects.set(projectId, project);
        await saveProjects();

        res.status(201).json({
            success: true,
            data: project,
            message: 'Project created successfully'
        });
    } catch (error) {
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

module.exports = router;