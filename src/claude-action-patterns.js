/**
 * Claude Action Patterns - Direct execution without questions
 */

class ActionPatterns {
  constructor() {
    this.patterns = this.initializePatterns();
  }

  initializePatterns() {
    return {
      // Direct file operations
      createFile: {
        pattern: /create|write|generate|make/i,
        action: (params) => this.createFileDirectly(params),
        requiresConfirmation: false
      },

      // Project setup
      setupProject: {
        pattern: /setup|initialize|init|bootstrap/i,
        action: (params) => this.setupProjectDirectly(params),
        requiresConfirmation: false
      },

      // Run commands
      runCommand: {
        pattern: /run|execute|start|launch/i,
        action: (params) => this.runCommandDirectly(params),
        requiresConfirmation: false
      },

      // Docker operations
      dockerOps: {
        pattern: /docker|container|compose/i,
        action: (params) => this.dockerOperationDirectly(params),
        requiresConfirmation: false
      },

      // Git operations
      gitOps: {
        pattern: /git|commit|push|pull|clone/i,
        action: (params) => this.gitOperationDirectly(params),
        requiresConfirmation: false
      },

      // Testing
      runTests: {
        pattern: /test|spec|jest|mocha|pytest/i,
        action: (params) => this.runTestsDirectly(params),
        requiresConfirmation: false
      },

      // Building
      buildProject: {
        pattern: /build|compile|bundle|webpack/i,
        action: (params) => this.buildProjectDirectly(params),
        requiresConfirmation: false
      },

      // Installation
      installDeps: {
        pattern: /install|add|npm|yarn|pip/i,
        action: (params) => this.installDependenciesDirectly(params),
        requiresConfirmation: false
      }
    };
  }

  async processInput(input) {
    // Find matching pattern
    for (const [key, pattern] of Object.entries(this.patterns)) {
      if (pattern.pattern.test(input)) {
        // Execute immediately without confirmation
        return await pattern.action({ input, key });
      }
    }

    // Default action - execute as is
    return this.executeDefault(input);
  }

  createFileDirectly({ input }) {
    const fileMatch = input.match(/(?:file|create|write)\s+([^\s]+)/i);
    if (fileMatch) {
      const filename = fileMatch[1];
      const content = this.generateDefaultContent(filename);

      require('fs').writeFileSync(filename, content);
      return { success: true, message: `Created ${filename}` };
    }
  }

  setupProjectDirectly({ input }) {
    const commands = [
      'npm init -y',
      'npm install',
      'mkdir -p src test data config',
      'touch .env .gitignore README.md'
    ];

    const { execSync } = require('child_process');
    commands.forEach(cmd => {
      try {
        execSync(cmd);
      } catch (e) {}
    });

    return { success: true, message: 'Project setup complete' };
  }

  runCommandDirectly({ input }) {
    const { execSync } = require('child_process');

    // Extract command after 'run' keyword
    const cmdMatch = input.match(/(?:run|execute|start)\s+(.+)/i);
    if (cmdMatch) {
      const command = cmdMatch[1];

      // Add smart defaults
      const enhancedCommand = this.enhanceCommand(command);

      try {
        execSync(enhancedCommand, { stdio: 'inherit' });
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }

  dockerOperationDirectly({ input }) {
    const { execSync } = require('child_process');
    const operations = {
      'up': 'docker-compose up -d',
      'down': 'docker-compose down',
      'build': 'docker-compose build --no-cache',
      'restart': 'docker-compose restart',
      'logs': 'docker-compose logs -f',
      'ps': 'docker ps',
      'start': 'docker-compose up -d'
    };

    for (const [key, cmd] of Object.entries(operations)) {
      if (input.includes(key)) {
        try {
          execSync(cmd, { stdio: 'inherit' });
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    }

    // Default docker operation
    try {
      execSync('docker-compose up -d', { stdio: 'inherit' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  gitOperationDirectly({ input }) {
    const { execSync } = require('child_process');
    const operations = {
      'status': 'git status',
      'commit': 'git add . && git commit -m "Auto-commit: Updates"',
      'push': 'git push',
      'pull': 'git pull',
      'clone': (url) => `git clone ${url}`,
      'branch': 'git branch',
      'checkout': (branch) => `git checkout ${branch}`
    };

    for (const [key, cmd] of Object.entries(operations)) {
      if (input.includes(key)) {
        const command = typeof cmd === 'function' ? cmd(this.extractParam(input)) : cmd;
        try {
          execSync(command, { stdio: 'inherit' });
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    }
  }

  runTestsDirectly({ input }) {
    const { execSync } = require('child_process');
    const testCommands = [
      'npm test',
      'npm run test',
      'jest',
      'mocha',
      'pytest',
      'go test ./...'
    ];

    for (const cmd of testCommands) {
      try {
        execSync(cmd, { stdio: 'inherit' });
        return { success: true, command: cmd };
      } catch (e) {
        // Try next command
      }
    }

    return { success: false, message: 'No test command found' };
  }

  buildProjectDirectly({ input }) {
    const { execSync } = require('child_process');
    const buildCommands = [
      'npm run build',
      'npm run compile',
      'webpack',
      'tsc',
      'go build',
      'make'
    ];

    for (const cmd of buildCommands) {
      try {
        execSync(cmd, { stdio: 'inherit' });
        return { success: true, command: cmd };
      } catch (e) {
        // Try next command
      }
    }

    return { success: false, message: 'No build command found' };
  }

  installDependenciesDirectly({ input }) {
    const { execSync } = require('child_process');

    // Detect package manager and package name
    const npmMatch = input.match(/npm\s+(?:install|i|add)\s+(.+)/i);
    const yarnMatch = input.match(/yarn\s+add\s+(.+)/i);
    const pipMatch = input.match(/pip\s+install\s+(.+)/i);

    let command;
    if (npmMatch) {
      command = `npm install ${npmMatch[1]}`;
    } else if (yarnMatch) {
      command = `yarn add ${yarnMatch[1]}`;
    } else if (pipMatch) {
      command = `pip install ${pipMatch[1]}`;
    } else if (input.includes('install')) {
      // Default to npm install
      command = 'npm install';
    }

    if (command) {
      try {
        execSync(command, { stdio: 'inherit' });
        return { success: true, command };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }

  enhanceCommand(command) {
    // Add environment variables if missing
    const enhancements = {
      'npm start': 'PORT=5000 NODE_ENV=development npm start',
      'node server': 'PORT=5000 NODE_ENV=development node server.js',
      'python app': 'FLASK_ENV=development python app.py'
    };

    for (const [key, enhanced] of Object.entries(enhancements)) {
      if (command.includes(key)) {
        return enhanced;
      }
    }

    return command;
  }

  generateDefaultContent(filename) {
    const ext = require('path').extname(filename);
    const defaults = {
      '.js': '// JavaScript file\nmodule.exports = {};\n',
      '.py': '#!/usr/bin/env python3\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n',
      '.html': '<!DOCTYPE html>\n<html>\n<head>\n    <title>Page</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n</body>\n</html>\n',
      '.json': '{\n  "name": "project",\n  "version": "1.0.0"\n}\n',
      '.md': '# Documentation\n\n## Overview\n\nContent here.\n',
      '.env': 'NODE_ENV=development\nPORT=5000\n',
      '.gitignore': 'node_modules/\n.env\n*.log\ndist/\n'
    };

    return defaults[ext] || '// File content\n';
  }

  extractParam(input) {
    const words = input.split(' ');
    return words[words.length - 1];
  }

  executeDefault(input) {
    const { execSync } = require('child_process');
    try {
      execSync(input, { stdio: 'inherit' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = ActionPatterns;