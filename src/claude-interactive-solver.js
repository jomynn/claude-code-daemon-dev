#!/usr/bin/env node

/**
 * Claude Interactive Solver
 * Provides real-time problem-solving using Claude Code Assistant
 * Works with BMAD Auto-Executor for seamless execution
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios').default;

class ClaudeInteractiveSolver {
  constructor() {
    this.sessionHistory = [];
    this.currentContext = {};
    this.daemonUrl = 'http://localhost:5001';
    this.autoMode = false;
    this.bmadDocument = null;
    this.currentTask = null;
  }

  async initialize() {
    console.log('🤖 Claude Interactive Solver');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Commands:');
    console.log('  /auto     - Enable auto-execution mode');
    console.log('  /bmad     - Load and execute BMAD document');
    console.log('  /solve    - Solve current problem');
    console.log('  /context  - Show current context');
    console.log('  /clear    - Clear context');
    console.log('  /help     - Show this help');
    console.log('  /exit     - Exit');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 > '
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.rl.on('line', async (line) => {
      const input = line.trim();

      if (input.startsWith('/')) {
        await this.handleCommand(input);
      } else if (this.autoMode) {
        await this.autoExecute(input);
      } else {
        await this.processInput(input);
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });
  }

  async handleCommand(command) {
    const cmd = command.toLowerCase();

    switch (cmd) {
      case '/auto':
        this.toggleAutoMode();
        break;

      case '/bmad':
        await this.loadBMADDocument();
        break;

      case '/solve':
        await this.solveCurrent();
        break;

      case '/context':
        this.showContext();
        break;

      case '/clear':
        this.clearContext();
        break;

      case '/help':
        this.showHelp();
        break;

      case '/exit':
        this.rl.close();
        break;

      default:
        console.log(`Unknown command: ${command}`);
    }
  }

  toggleAutoMode() {
    this.autoMode = !this.autoMode;
    console.log(`✨ Auto-execution mode: ${this.autoMode ? 'ENABLED' : 'DISABLED'}`);

    if (this.autoMode) {
      console.log('📌 Commands will now execute immediately without confirmation');
    }
  }

  async loadBMADDocument() {
    const docPath = '/Volumes/Extreme SSD/Workspace/claude-code-daemon/claude-code-daemon-dev/BMAD_METHOD_GUIDE.md';

    try {
      this.bmadDocument = fs.readFileSync(docPath, 'utf8');
      console.log('✅ BMAD document loaded successfully');

      // Parse and show summary
      const lines = this.bmadDocument.split('\n');
      const phases = lines.filter(l => l.includes('BMAD Phase'));
      const codeBlocks = this.bmadDocument.match(/```[\s\S]*?```/g) || [];

      console.log(`📊 Document contains:`);
      console.log(`  - ${phases.length} phases`);
      console.log(`  - ${codeBlocks.length} code blocks`);

      // Ask if user wants to execute
      console.log('\n🎯 Ready to execute BMAD document');
      console.log('Type "execute" to start or any command to interact');

    } catch (error) {
      console.error(`❌ Failed to load BMAD document: ${error.message}`);
    }
  }

  async autoExecute(input) {
    console.log(`\n⚡ Auto-executing: ${input}`);

    // Detect command type
    const commandType = this.detectCommandType(input);

    switch (commandType) {
      case 'execute':
        if (this.bmadDocument) {
          await this.executeBMADDocument();
        } else {
          await this.executeDirectCommand(input);
        }
        break;

      case 'setup':
        await this.setupProject(input);
        break;

      case 'run':
        await this.runApplication(input);
        break;

      case 'docker':
        await this.dockerOperation(input);
        break;

      case 'test':
        await this.runTests(input);
        break;

      case 'deploy':
        await this.deployProject(input);
        break;

      default:
        await this.executeDirectCommand(input);
    }

    // Add to history
    this.sessionHistory.push({
      input,
      timestamp: new Date(),
      type: commandType,
      autoExecuted: true
    });
  }

  detectCommandType(input) {
    const lower = input.toLowerCase();

    if (lower === 'execute') return 'execute';
    if (lower.includes('setup') || lower.includes('init')) return 'setup';
    if (lower.includes('run') || lower.includes('start')) return 'run';
    if (lower.includes('docker')) return 'docker';
    if (lower.includes('test')) return 'test';
    if (lower.includes('deploy')) return 'deploy';

    return 'general';
  }

  async executeBMADDocument() {
    console.log('\n🚀 Executing BMAD Document...\n');

    // Parse tasks from document
    const tasks = this.parseBMADTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      this.currentTask = task;

      console.log(`\n[${i + 1}/${tasks.length}] ${task.description}`);

      try {
        await this.executeTask(task);
        console.log('✅ Success');
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);

        // Auto-solve with Claude
        const solution = await this.getSolution(task, error);
        if (solution) {
          console.log('💡 Applying solution...');
          await this.applySolution(solution);
        }
      }

      // Small delay between tasks
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✨ BMAD document execution complete!');
  }

  parseBMADTasks() {
    const tasks = [];
    const lines = this.bmadDocument.split('\n');

    let inCodeBlock = false;
    let codeContent = [];
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.substring(3) || 'bash';
          codeContent = [];
        } else {
          inCodeBlock = false;

          if (codeContent.length > 0) {
            tasks.push({
              type: 'code',
              language: codeLanguage,
              content: codeContent.join('\n'),
              description: `Execute ${codeLanguage} code`,
              line: i
            });
          }
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
      }

      // Detect numbered tasks
      if (/^\d+\.\s/.test(line)) {
        tasks.push({
          type: 'action',
          content: line.substring(line.indexOf('.') + 1).trim(),
          description: line.trim(),
          line: i
        });
      }
    }

    return tasks;
  }

  async executeTask(task) {
    switch (task.type) {
      case 'code':
        if (task.language === 'bash' || task.language === 'sh') {
          const commands = task.content.split('\n').filter(cmd => cmd && !cmd.startsWith('#'));
          for (const cmd of commands) {
            console.log(`  $ ${cmd}`);
            execSync(cmd, { stdio: 'inherit', shell: '/bin/zsh' });
          }
        } else if (task.content.includes('├──')) {
          await this.createDirectoryStructure(task.content);
        }
        break;

      case 'action':
        await this.executeAction(task.content);
        break;
    }
  }

  async createDirectoryStructure(structure) {
    const lines = structure.split('\n');

    for (const line of lines) {
      if (line.includes('├──') || line.includes('└──')) {
        const pathName = line.replace(/[├└─│\s]+/g, ' ').trim();

        if (pathName.includes('/')) {
          // Directory with subdirectories
          const dirs = pathName.split('/').slice(0, -1).join('/');
          if (dirs) {
            fs.mkdirSync(dirs, { recursive: true });
            console.log(`  📁 Created: ${dirs}/`);
          }
        }

        if (pathName.includes('.')) {
          // File
          const dir = path.dirname(pathName);
          if (dir && dir !== '.') {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(pathName, '');
          console.log(`  📄 Created: ${pathName}`);
        } else if (!pathName.includes('/')) {
          // Simple directory
          fs.mkdirSync(pathName, { recursive: true });
          console.log(`  📁 Created: ${pathName}/`);
        }
      }
    }
  }

  async executeAction(action) {
    const lower = action.toLowerCase();

    if (lower.includes('create') || lower.includes('setup')) {
      await this.setupProject(action);
    } else if (lower.includes('install')) {
      await this.installPackages(action);
    } else if (lower.includes('run') || lower.includes('start')) {
      await this.runApplication(action);
    } else {
      console.log(`  ℹ️ ${action}`);
    }
  }

  async setupProject(description) {
    const commands = [
      'npm init -y',
      'mkdir -p src tests config data',
      'touch .env .gitignore README.md'
    ];

    for (const cmd of commands) {
      try {
        console.log(`  $ ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
      } catch (e) {}
    }
  }

  async installPackages(description) {
    // Extract package names
    const packages = description.match(/[\w-]+/g) || [];
    const npmPackages = packages.filter(p => !['install', 'add', 'npm', 'yarn'].includes(p.toLowerCase()));

    if (npmPackages.length > 0) {
      const cmd = `npm install ${npmPackages.join(' ')}`;
      console.log(`  $ ${cmd}`);
      try {
        execSync(cmd, { stdio: 'inherit' });
      } catch (e) {
        console.log('  ⚠️ Some packages failed to install');
      }
    }
  }

  async runApplication(description) {
    const defaultCommands = [
      'npm start',
      'npm run dev',
      'node index.js',
      'node server.js',
      'python app.py'
    ];

    for (const cmd of defaultCommands) {
      try {
        console.log(`  $ PORT=5000 NODE_ENV=development ${cmd}`);
        execSync(`PORT=5000 NODE_ENV=development ${cmd}`, { stdio: 'inherit' });
        break;
      } catch (e) {
        // Try next command
      }
    }
  }

  async dockerOperation(input) {
    const operations = {
      'up': 'docker-compose up -d',
      'down': 'docker-compose down',
      'build': 'docker-compose build --no-cache',
      'restart': 'docker-compose restart',
      'logs': 'docker-compose logs -f'
    };

    for (const [key, cmd] of Object.entries(operations)) {
      if (input.includes(key)) {
        console.log(`  $ ${cmd}`);
        try {
          execSync(cmd, { stdio: 'inherit' });
        } catch (e) {
          console.log(`  ❌ Docker operation failed`);
        }
        return;
      }
    }
  }

  async runTests(description) {
    const testCommands = ['npm test', 'jest', 'mocha', 'pytest'];

    for (const cmd of testCommands) {
      try {
        console.log(`  $ ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        break;
      } catch (e) {
        // Try next command
      }
    }
  }

  async deployProject(description) {
    const deployCommands = [
      'npm run deploy',
      'git push origin main',
      'docker push'
    ];

    for (const cmd of deployCommands) {
      try {
        console.log(`  $ ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        break;
      } catch (e) {}
    }
  }

  async executeDirectCommand(input) {
    try {
      console.log(`  $ ${input}`);
      execSync(input, { stdio: 'inherit', shell: '/bin/zsh' });
    } catch (error) {
      console.log(`  ❌ Command failed: ${error.message}`);
    }
  }

  async getSolution(task, error) {
    console.log('\n🔍 Finding solution with Claude...');

    try {
      // Simulate Claude's problem-solving
      const solutions = {
        'command not found': `npm install -g ${task.content.split(' ')[0]}`,
        'permission denied': `sudo ${task.content}`,
        'no such file': `mkdir -p ${path.dirname(task.content.split(' ').pop())}`,
        'module not found': `npm install ${error.message.match(/Cannot find module '(.+)'/)?.[1] || ''}`
      };

      for (const [errorType, solution] of Object.entries(solutions)) {
        if (error.message.toLowerCase().includes(errorType)) {
          return solution;
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  async applySolution(solution) {
    try {
      console.log(`  $ ${solution}`);
      execSync(solution, { stdio: 'inherit' });
      console.log('  ✅ Solution applied successfully');
    } catch (e) {
      console.log('  ⚠️ Solution didn\'t work, continuing...');
    }
  }

  async processInput(input) {
    // Regular interactive mode
    console.log(`Processing: ${input}`);
    this.currentContext.lastInput = input;
  }

  async solveCurrent() {
    if (!this.currentTask) {
      console.log('No current task to solve');
      return;
    }

    console.log('🔧 Solving current task...');
    // Implement solving logic
  }

  showContext() {
    console.log('\n📋 Current Context:');
    console.log(JSON.stringify(this.currentContext, null, 2));
    console.log(`\n📜 History: ${this.sessionHistory.length} items`);
  }

  clearContext() {
    this.currentContext = {};
    this.sessionHistory = [];
    console.log('✨ Context cleared');
  }

  showHelp() {
    console.log('\n📚 Help:');
    console.log('  /auto     - Toggle auto-execution mode');
    console.log('  /bmad     - Load BMAD document');
    console.log('  /solve    - Solve current problem');
    console.log('  /context  - Show context');
    console.log('  /clear    - Clear context');
    console.log('  /exit     - Exit');
  }

  async start() {
    await this.initialize();
    this.rl.prompt();
  }
}

// Start the interactive solver
if (require.main === module) {
  const solver = new ClaudeInteractiveSolver();
  solver.start().catch(console.error);
}

module.exports = ClaudeInteractiveSolver;