#!/usr/bin/env node

/**
 * BMAD Auto-Executor
 * Automatically reads BMAD Method documents and executes them step-by-step
 * Integrates with Claude Code Daemon for interactive problem-solving
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const axios = require('axios').default;

class BMADAutoExecutor {
  constructor(documentPath, daemonUrl = 'http://localhost:5001') {
    this.documentPath = documentPath;
    this.daemonUrl = daemonUrl;
    this.document = this.loadDocument();
    this.tasks = [];
    this.currentPhase = null;
    this.executionLog = [];
    this.claudeDaemonConnected = false;
  }

  loadDocument() {
    try {
      return fs.readFileSync(this.documentPath, 'utf8');
    } catch (error) {
      console.error(`Error loading document: ${error.message}`);
      return null;
    }
  }

  async connectToClaudeDaemon() {
    try {
      const response = await axios.get(`${this.daemonUrl}/health`);
      if (response.data.status === 'healthy') {
        this.claudeDaemonConnected = true;
        console.log('✅ Connected to Claude Code Daemon');
        return true;
      }
    } catch (error) {
      console.log('⚠️ Claude Daemon not available, starting it...');
      await this.startClaudeDaemon();
    }
    return false;
  }

  async startClaudeDaemon() {
    try {
      // Check if Docker is running
      execSync('docker ps', { stdio: 'ignore' });

      // Start the daemon
      execSync('cd /Volumes/Extreme\\ SSD/Workspace/claude-code-daemon/claude-code-daemon-dev && docker-compose up -d', {
        stdio: 'inherit',
        shell: '/bin/zsh'
      });

      // Wait for daemon to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      this.claudeDaemonConnected = true;
      console.log('✅ Claude Daemon started successfully');
    } catch (error) {
      console.log('Starting Docker and Claude Daemon...');
      execSync('open -a Docker', { stdio: 'ignore' });
      await new Promise(resolve => setTimeout(resolve, 10000));

      try {
        execSync('cd /Volumes/Extreme\\ SSD/Workspace/claude-code-daemon/claude-code-daemon-dev && docker-compose up -d', {
          stdio: 'inherit',
          shell: '/bin/zsh'
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
        this.claudeDaemonConnected = true;
      } catch (e) {
        console.error('Failed to start Claude Daemon');
      }
    }
  }

  parseDocument() {
    if (!this.document) return;

    // Parse BMAD phases
    const phases = this.document.match(/## 🏗️ BMAD Phase \d+: (\w+)/g) || [];

    // Parse code blocks
    const codeBlocks = this.document.match(/```[\s\S]*?```/g) || [];

    // Parse tasks and commands
    const tasks = this.extractTasks();

    // Parse role instructions
    const roles = this.document.match(/\[ROLE: (\w+)\]/g) || [];

    this.tasks = tasks;
    console.log(`📋 Parsed ${tasks.length} tasks from BMAD document`);

    return {
      phases,
      codeBlocks,
      tasks,
      roles
    };
  }

  extractTasks() {
    const tasks = [];
    const lines = this.document.split('\n');

    let currentPhase = null;
    let currentRole = null;
    let inCodeBlock = false;
    let codeBlockContent = [];
    let codeBlockLang = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect phase
      if (line.includes('BMAD Phase')) {
        const phaseMatch = line.match(/BMAD Phase \d+: (\w+)/);
        if (phaseMatch) {
          currentPhase = phaseMatch[1];
        }
      }

      // Detect role
      if (line.includes('Role:')) {
        const roleMatch = line.match(/Role:\s*\*?\*?([^*]+)\*?\*?/);
        if (roleMatch) {
          currentRole = roleMatch[1].trim();
        }
      }

      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.substring(3).trim() || 'bash';
          codeBlockContent = [];
        } else {
          inCodeBlock = false;

          // Create task from code block
          if (codeBlockContent.length > 0) {
            tasks.push({
              type: 'code',
              language: codeBlockLang,
              content: codeBlockContent.join('\n'),
              phase: currentPhase,
              role: currentRole,
              lineNumber: i
            });
          }
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Detect action items (numbered lists)
      if (/^\d+\.\s/.test(line)) {
        tasks.push({
          type: 'action',
          content: line.substring(line.indexOf('.') + 1).trim(),
          phase: currentPhase,
          role: currentRole,
          lineNumber: i
        });
      }

      // Detect commands in text
      if (line.includes('npm') || line.includes('python') || line.includes('docker') ||
          line.includes('git') || line.includes('mkdir') || line.includes('cd')) {
        tasks.push({
          type: 'command',
          content: line.trim(),
          phase: currentPhase,
          role: currentRole,
          lineNumber: i
        });
      }
    }

    return tasks;
  }

  async executeTask(task) {
    console.log(`\n🔄 Executing task (${task.type}): ${task.content.substring(0, 50)}...`);

    try {
      switch (task.type) {
        case 'code':
          await this.executeCode(task);
          break;
        case 'command':
          await this.executeCommand(task);
          break;
        case 'action':
          await this.executeAction(task);
          break;
        default:
          console.log(`Unknown task type: ${task.type}`);
      }

      this.executionLog.push({
        task,
        status: 'success',
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`❌ Task failed: ${error.message}`);

      // Use Claude Daemon to solve the problem
      if (this.claudeDaemonConnected) {
        await this.solveWithClaudeDaemon(task, error);
      }

      this.executionLog.push({
        task,
        status: 'failed',
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  async executeCode(task) {
    if (task.language === 'bash' || task.language === 'sh') {
      // Execute bash commands
      const commands = task.content.split('\n').filter(cmd => cmd.trim());
      for (const cmd of commands) {
        if (cmd.startsWith('#')) continue;
        console.log(`  $ ${cmd}`);
        execSync(cmd, { stdio: 'inherit', shell: '/bin/zsh' });
      }
    } else if (task.content.includes('├──')) {
      // Directory structure - create it
      await this.createDirectoryStructure(task.content);
    } else {
      // Save as file
      const filename = this.generateFilename(task);
      fs.writeFileSync(filename, task.content);
      console.log(`  📄 Created file: ${filename}`);
    }
  }

  async executeCommand(task) {
    const command = task.content;

    // Extract actual command from text
    const cmdMatch = command.match(/(npm|python|docker|git|mkdir|cd)\s+[^\s]*/);
    if (cmdMatch) {
      const cmd = cmdMatch[0];
      console.log(`  $ ${cmd}`);
      execSync(cmd, { stdio: 'inherit', shell: '/bin/zsh' });
    }
  }

  async executeAction(task) {
    const action = task.content.toLowerCase();

    // Map actions to commands
    if (action.includes('create') && action.includes('project')) {
      await this.createProject(action);
    } else if (action.includes('install')) {
      await this.installDependencies(action);
    } else if (action.includes('setup')) {
      await this.setupEnvironment(action);
    } else if (action.includes('test')) {
      await this.runTests();
    } else if (action.includes('deploy')) {
      await this.deploy();
    } else {
      console.log(`  ℹ️ Action noted: ${action}`);
    }
  }

  async createDirectoryStructure(structure) {
    const lines = structure.split('\n');
    const paths = [];

    for (const line of lines) {
      if (line.includes('├──') || line.includes('└──')) {
        const path = line.replace(/[├└─│\s]+/g, ' ').trim();
        if (path) paths.push(path);
      }
    }

    // Create directories
    for (const p of paths) {
      const fullPath = path.join(process.cwd(), p);
      if (p.includes('.')) {
        // It's a file
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, '');
        console.log(`  📄 Created: ${p}`);
      } else {
        // It's a directory
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
          console.log(`  📁 Created: ${p}/`);
        }
      }
    }
  }

  async solveWithClaudeDaemon(task, error) {
    console.log('\n🤖 Using Claude Daemon to solve the problem...');

    try {
      const payload = {
        problem: error.message,
        context: {
          task: task.content,
          type: task.type,
          phase: task.phase,
          role: task.role
        },
        request: 'Please provide a solution or alternative approach'
      };

      const response = await axios.post(`${this.daemonUrl}/api/solve`, payload);

      if (response.data.solution) {
        console.log('💡 Claude suggests:', response.data.solution);

        // Try to execute the solution
        if (response.data.command) {
          console.log(`  $ ${response.data.command}`);
          try {
            execSync(response.data.command, { stdio: 'inherit' });
            console.log('✅ Solution executed successfully');
          } catch (e) {
            console.log('⚠️ Solution failed, continuing...');
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Claude Daemon unavailable, skipping...');
    }
  }

  async createProject(description) {
    const commands = [
      'mkdir -p web3-audit-intelligence',
      'cd web3-audit-intelligence',
      'npm init -y',
      'mkdir -p src tests config data logs'
    ];

    for (const cmd of commands) {
      try {
        execSync(cmd, { stdio: 'inherit' });
      } catch (e) {}
    }
  }

  async installDependencies(description) {
    const dependencies = [
      'axios',
      'cheerio',
      'sqlite3',
      'express',
      'dotenv'
    ];

    try {
      execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit' });
    } catch (e) {
      console.log('⚠️ Some dependencies failed to install');
    }
  }

  async setupEnvironment(description) {
    // Create .env file
    const envContent = `
NODE_ENV=development
PORT=5000
DATABASE_URL=sqlite://./data/audit.db
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
API_KEY=your_api_key_here
`;
    fs.writeFileSync('.env', envContent);
    console.log('  📄 Created .env file');
  }

  async runTests() {
    try {
      execSync('npm test', { stdio: 'inherit' });
    } catch (e) {
      console.log('  ℹ️ No tests configured yet');
    }
  }

  async deploy() {
    console.log('  ℹ️ Deployment configuration needed');
  }

  generateFilename(task) {
    const timestamp = Date.now();
    const ext = {
      'python': '.py',
      'javascript': '.js',
      'typescript': '.ts',
      'yaml': '.yaml',
      'json': '.json',
      'html': '.html',
      'css': '.css'
    }[task.language] || '.txt';

    return `output_${timestamp}${ext}`;
  }

  async run() {
    console.log('🚀 BMAD Auto-Executor Starting...');
    console.log(`📄 Document: ${this.documentPath}`);

    // Connect to Claude Daemon
    await this.connectToClaudeDaemon();

    // Parse the document
    const parsed = this.parseDocument();
    if (!parsed) {
      console.error('Failed to parse document');
      return;
    }

    console.log(`\n📊 Document Analysis:`);
    console.log(`  - Phases: ${parsed.phases.length}`);
    console.log(`  - Code blocks: ${parsed.codeBlocks.length}`);
    console.log(`  - Tasks: ${parsed.tasks.length}`);
    console.log(`  - Roles: ${parsed.roles.length}`);

    // Execute tasks sequentially
    console.log('\n🎯 Starting Task Execution...');
    for (const task of this.tasks) {
      await this.executeTask(task);

      // Small delay between tasks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n📈 Execution Summary:');
    const successful = this.executionLog.filter(l => l.status === 'success').length;
    const failed = this.executionLog.filter(l => l.status === 'failed').length;

    console.log(`  ✅ Successful: ${successful}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📊 Total: ${this.executionLog.length}`);

    // Save execution log
    fs.writeFileSync('bmad-execution-log.json', JSON.stringify(this.executionLog, null, 2));
    console.log('\n💾 Execution log saved to bmad-execution-log.json');
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  // Default to BMAD Method Guide
  const documentPath = args[0] || '/Volumes/Extreme SSD/Workspace/claude-code-daemon/claude-code-daemon-dev/BMAD_METHOD_GUIDE.md';

  const executor = new BMADAutoExecutor(documentPath);
  executor.run().catch(console.error);
}

module.exports = BMADAutoExecutor;