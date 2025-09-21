#!/usr/bin/env node

/**
 * Claude Assistant Enhancer - Action-First Mode
 * Executes commands immediately without endless questions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ClaudeAssistantEnhancer {
  constructor() {
    this.config = this.loadConfig();
    this.commandHistory = [];
    this.smartDefaults = new Map();
    this.initializeDefaults();
  }

  loadConfig() {
    const configPath = path.join(__dirname, '..', 'claude-assistant-config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  initializeDefaults() {
    // Pre-populate smart defaults
    this.smartDefaults.set('port', process.env.PORT || 5000);
    this.smartDefaults.set('env', process.env.NODE_ENV || 'development');
    this.smartDefaults.set('database', process.env.DATABASE_PATH || './data/app.db');
    this.smartDefaults.set('redis_url', process.env.REDIS_URL || 'redis://localhost:6379');
    this.smartDefaults.set('log_level', process.env.LOG_LEVEL || 'info');
  }

  /**
   * Process user command with action-first approach
   */
  async processCommand(userInput) {
    const command = this.parseCommand(userInput);

    // Skip confirmations and execute directly
    if (this.shouldAutoExecute(command)) {
      return this.executeDirectly(command);
    }

    // Fill missing parameters with smart defaults
    const enhancedCommand = this.fillDefaults(command);

    // Execute without asking for confirmation
    return this.execute(enhancedCommand);
  }

  parseCommand(input) {
    const patterns = {
      setup: /^(setup|install|init|create)/i,
      run: /^(run|start|launch|execute)/i,
      build: /^(build|compile|make)/i,
      test: /^(test|check|verify)/i,
      deploy: /^(deploy|push|publish)/i,
      docker: /^(docker|container)/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(input)) {
        return { type, raw: input, parsed: true };
      }
    }

    return { type: 'general', raw: input, parsed: false };
  }

  shouldAutoExecute(command) {
    const autoExecuteTypes = ['setup', 'run', 'build', 'test', 'docker'];
    return autoExecuteTypes.includes(command.type);
  }

  fillDefaults(command) {
    const enhanced = { ...command };

    switch (command.type) {
      case 'run':
        enhanced.port = this.smartDefaults.get('port');
        enhanced.env = this.smartDefaults.get('env');
        break;
      case 'docker':
        enhanced.compose_file = './docker-compose.yml';
        enhanced.dockerfile = './Dockerfile';
        break;
      case 'setup':
        enhanced.package_manager = 'npm';
        enhanced.install_deps = true;
        break;
    }

    return enhanced;
  }

  async executeDirectly(command) {
    const actions = {
      setup: () => this.setupProject(),
      run: () => this.runApplication(),
      build: () => this.buildProject(),
      test: () => this.runTests(),
      docker: () => this.dockerOperations(command),
      deploy: () => this.deployProject()
    };

    const action = actions[command.type];
    if (action) {
      return action();
    }

    return this.execute(command);
  }

  setupProject() {
    const commands = [
      'npm install',
      'mkdir -p data logs config',
      'cp .env.example .env 2>/dev/null || true',
      'npm run prepare 2>/dev/null || true'
    ];

    console.log('🚀 Setting up project...');
    commands.forEach(cmd => {
      try {
        execSync(cmd, { stdio: 'inherit' });
      } catch (e) {
        // Continue on error
      }
    });
    console.log('✅ Setup complete');
  }

  runApplication() {
    const port = this.smartDefaults.get('port');
    const env = this.smartDefaults.get('env');

    console.log(`🚀 Starting application on port ${port}...`);
    const command = `PORT=${port} NODE_ENV=${env} npm start`;

    try {
      execSync(command, { stdio: 'inherit' });
    } catch (e) {
      // Try alternative start commands
      const alternatives = ['npm run dev', 'node index.js', 'node server.js'];
      for (const alt of alternatives) {
        try {
          execSync(`PORT=${port} NODE_ENV=${env} ${alt}`, { stdio: 'inherit' });
          break;
        } catch (e) {
          continue;
        }
      }
    }
  }

  buildProject() {
    console.log('🔨 Building project...');
    const commands = ['npm run build', 'npm run compile', 'make'];

    for (const cmd of commands) {
      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log('✅ Build successful');
        return;
      } catch (e) {
        continue;
      }
    }
  }

  runTests() {
    console.log('🧪 Running tests...');
    const commands = ['npm test', 'npm run test', 'jest', 'mocha'];

    for (const cmd of commands) {
      try {
        execSync(cmd, { stdio: 'inherit' });
        return;
      } catch (e) {
        continue;
      }
    }
  }

  dockerOperations(command) {
    const operations = {
      'docker build': 'docker-compose build --no-cache',
      'docker up': 'docker-compose up -d',
      'docker down': 'docker-compose down',
      'docker restart': 'docker-compose restart',
      'docker logs': 'docker-compose logs -f'
    };

    const rawLower = command.raw.toLowerCase();
    for (const [key, cmd] of Object.entries(operations)) {
      if (rawLower.includes(key.split(' ')[1])) {
        console.log(`🐳 Executing: ${cmd}`);
        try {
          execSync(cmd, { stdio: 'inherit' });
        } catch (e) {
          console.error(`Error: ${e.message}`);
        }
        return;
      }
    }

    // Default docker operation
    try {
      execSync('docker-compose up -d', { stdio: 'inherit' });
    } catch (e) {
      console.error('Docker operation failed');
    }
  }

  deployProject() {
    console.log('🚀 Deploying project...');
    const commands = [
      'npm run deploy',
      'git push origin main',
      'npm publish'
    ];

    for (const cmd of commands) {
      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log('✅ Deployment successful');
        return;
      } catch (e) {
        continue;
      }
    }
  }

  execute(command) {
    console.log(`⚡ Executing: ${command.raw}`);
    try {
      execSync(command.raw, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Error executing command: ${e.message}`);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const enhancer = new ClaudeAssistantEnhancer();
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const command = args.join(' ');
    enhancer.processCommand(command);
  } else {
    console.log('Claude Assistant Enhancer - Action-First Mode');
    console.log('Usage: claude-enhance <command>');
    console.log('Examples:');
    console.log('  claude-enhance setup');
    console.log('  claude-enhance run');
    console.log('  claude-enhance docker up');
    console.log('  claude-enhance test');
  }
}

module.exports = ClaudeAssistantEnhancer;