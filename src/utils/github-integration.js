/**
 * GitHub Integration Utilities
 * Helper functions for GitHub repository operations
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class GitHubIntegration {
    constructor(options = {}) {
        this.apiToken = options.apiToken || process.env.GITHUB_TOKEN;
        this.defaultBranch = options.defaultBranch || 'main';
    }

    /**
     * Clone a GitHub repository to a local directory
     */
    async cloneRepository(repoUrl, targetDir, options = {}) {
        try {
            const { branch = this.defaultBranch, depth = null } = options;

            // Ensure target directory exists
            await fs.mkdir(path.dirname(targetDir), { recursive: true });

            let cloneCommand = `git clone ${repoUrl} "${targetDir}"`;

            if (branch && branch !== 'main' && branch !== 'master') {
                cloneCommand += ` --branch ${branch}`;
            }

            if (depth) {
                cloneCommand += ` --depth ${depth}`;
            }

            console.log(`Cloning repository: ${cloneCommand}`);
            execSync(cloneCommand, { stdio: 'inherit' });

            return {
                success: true,
                path: targetDir,
                repository: this.parseRepoUrl(repoUrl)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create a new GitHub repository (requires API token)
     */
    async createRepository(repoName, options = {}) {
        if (!this.apiToken) {
            throw new Error('GitHub API token is required for repository creation');
        }

        const {
            description = '',
            private: isPrivate = false,
            autoInit = true,
            gitignoreTemplate = 'Node',
            license = 'MIT'
        } = options;

        try {
            const response = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    name: repoName,
                    description,
                    private: isPrivate,
                    auto_init: autoInit,
                    gitignore_template: gitignoreTemplate,
                    license_template: license
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create repository');
            }

            return {
                success: true,
                repository: {
                    name: data.name,
                    fullName: data.full_name,
                    cloneUrl: data.clone_url,
                    sshUrl: data.ssh_url,
                    htmlUrl: data.html_url,
                    private: data.private
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Initialize a local directory as a git repository and push to GitHub
     */
    async initializeAndPush(localDir, repoUrl, options = {}) {
        try {
            const { branch = this.defaultBranch, commitMessage = 'Initial commit' } = options;

            // Initialize git repository
            execSync('git init', { cwd: localDir });

            // Add remote origin
            execSync(`git remote add origin ${repoUrl}`, { cwd: localDir });

            // Create and switch to main branch
            execSync(`git checkout -b ${branch}`, { cwd: localDir });

            // Add all files
            execSync('git add .', { cwd: localDir });

            // Create initial commit
            execSync(`git commit -m "${commitMessage}"`, { cwd: localDir });

            // Push to remote
            execSync(`git push -u origin ${branch}`, { cwd: localDir });

            return {
                success: true,
                branch,
                remote: repoUrl
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get repository information from GitHub API
     */
    async getRepositoryInfo(owner, repo) {
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3+json'
            };

            if (this.apiToken) {
                headers['Authorization'] = `token ${this.apiToken}`;
            }

            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                repository: {
                    name: data.name,
                    fullName: data.full_name,
                    description: data.description,
                    language: data.language,
                    stars: data.stargazers_count,
                    forks: data.forks_count,
                    issues: data.open_issues_count,
                    lastUpdated: data.updated_at,
                    defaultBranch: data.default_branch,
                    cloneUrl: data.clone_url,
                    sshUrl: data.ssh_url,
                    htmlUrl: data.html_url,
                    private: data.private
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if a directory is a git repository
     */
    async isGitRepository(dir) {
        try {
            const gitDir = path.join(dir, '.git');
            await fs.access(gitDir);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get git repository status
     */
    async getRepositoryStatus(dir) {
        try {
            if (!(await this.isGitRepository(dir))) {
                return {
                    isRepo: false,
                    error: 'Not a git repository'
                };
            }

            const statusOutput = execSync('git status --porcelain', {
                cwd: dir,
                encoding: 'utf8'
            });

            const remoteOutput = execSync('git remote -v', {
                cwd: dir,
                encoding: 'utf8'
            });

            const branchOutput = execSync('git branch --show-current', {
                cwd: dir,
                encoding: 'utf8'
            }).trim();

            const hasChanges = statusOutput.trim().length > 0;
            const remotes = this.parseGitRemotes(remoteOutput);

            return {
                isRepo: true,
                currentBranch: branchOutput,
                hasUncommittedChanges: hasChanges,
                remotes,
                status: statusOutput.trim()
            };
        } catch (error) {
            return {
                isRepo: false,
                error: error.message
            };
        }
    }

    /**
     * Create a .gitignore file for the project
     */
    async createGitignore(projectDir, template = 'node') {
        try {
            let gitignoreContent = '';

            switch (template.toLowerCase()) {
                case 'node':
                case 'nodejs':
                    gitignoreContent = this.getNodeGitignore();
                    break;
                case 'python':
                    gitignoreContent = this.getPythonGitignore();
                    break;
                case 'react':
                    gitignoreContent = this.getReactGitignore();
                    break;
                default:
                    gitignoreContent = this.getGenericGitignore();
            }

            const gitignorePath = path.join(projectDir, '.gitignore');
            await fs.writeFile(gitignorePath, gitignoreContent);

            return {
                success: true,
                path: gitignorePath
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse repository URL to extract owner and repo name
     */
    parseRepoUrl(repoUrl) {
        const patterns = [
            /https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/,
            /git@github\.com:([^\/]+)\/([^\/]+)(?:\.git)?/
        ];

        for (const pattern of patterns) {
            const match = repoUrl.match(pattern);
            if (match) {
                return {
                    owner: match[1],
                    repo: match[2].replace('.git', ''),
                    url: repoUrl
                };
            }
        }

        return null;
    }

    /**
     * Parse git remotes output
     */
    parseGitRemotes(remoteOutput) {
        const remotes = {};
        const lines = remoteOutput.trim().split('\n');

        lines.forEach(line => {
            const match = line.match(/^(\w+)\s+(.+?)\s+\((\w+)\)$/);
            if (match) {
                const [, name, url, type] = match;
                if (!remotes[name]) {
                    remotes[name] = {};
                }
                remotes[name][type] = url;
            }
        });

        return remotes;
    }

    /**
     * Generate Node.js .gitignore content
     */
    getNodeGitignore() {
        return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
package-lock.json
.pnpm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Logs
logs
*.log

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Coverage directory used by tools like istanbul
coverage/
.nyc_output

# Build outputs
dist/
build/
out/

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Temporary files
.tmp/
.temp/

# Claude Code Daemon specific
.claude-daemon/
data/*.db
logs/
`;
    }

    /**
     * Generate Python .gitignore content
     */
    getPythonGitignore() {
        return `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# PyInstaller
*.manifest
*.spec

# Installer logs
pip-log.txt
pip-delete-this-directory.txt

# Unit test / coverage reports
htmlcov/
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
.hypothesis/
.pytest_cache/

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;
    }

    /**
     * Generate React .gitignore content
     */
    getReactGitignore() {
        return `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
`;
    }

    /**
     * Generate generic .gitignore content
     */
    getGenericGitignore() {
        return `# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Build outputs
build/
dist/
out/

# Temporary files
tmp/
temp/
*.tmp
*.temp
`;
    }
}

module.exports = GitHubIntegration;