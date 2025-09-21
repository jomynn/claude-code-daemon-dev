# BMAD Auto-Executor & Interactive Solver 🚀

## Overview
Automatically reads and executes BMAD Method documents step-by-step, with intelligent problem-solving using Claude Code Daemon.

## Features

### 🎯 Auto-Execution
- **Reads** BMAD Method documents
- **Parses** all tasks, code blocks, and commands
- **Executes** everything automatically in sequence
- **Solves** problems using Claude Daemon when errors occur

### 🤖 Interactive Solver
- **Real-time** command execution
- **Auto-mode** for immediate execution
- **Problem-solving** with Claude integration
- **Context-aware** execution

## Quick Start

### 1. Run BMAD Document Automatically
```bash
# Execute default BMAD Method Guide
./run-bmad.sh

# Execute custom document
./run-bmad.sh /path/to/your/document.md
```

### 2. Interactive Mode
```bash
# Start interactive solver
node src/claude-interactive-solver.js
```

Then use commands:
- `/auto` - Enable auto-execution
- `/bmad` - Load and execute BMAD document
- `execute` - Start execution

### 3. Direct Execution
```bash
# Run auto-executor directly
node src/bmad-auto-executor.js BMAD_METHOD_GUIDE.md
```

## How It Works

### 1. Document Parsing
The executor reads your BMAD document and identifies:
- **Code blocks** (```bash, ```python, etc.)
- **Directory structures**
- **Numbered tasks** (1. Create project...)
- **Commands** in text (npm install, docker up, etc.)

### 2. Automatic Execution
For each identified task:
1. **Attempts execution** directly
2. **On failure** → Connects to Claude Daemon
3. **Gets solution** from Claude
4. **Applies fix** automatically
5. **Continues** to next task

### 3. Smart Problem Solving
When errors occur:
```javascript
Error: "command not found: npm"
Solution: Install npm or use alternative
Action: Tries yarn, then direct node execution
```

## Example Workflow

### Your BMAD Document:
```markdown
## Phase 1: BUILD

1. Create project structure
2. Install dependencies: axios cheerio sqlite3

```bash
mkdir -p src tests config
npm init -y
npm install express
```
```

### Automatic Execution:
```
🚀 BMAD Auto-Executor Starting...
📄 Document: BMAD_METHOD_GUIDE.md
✅ Connected to Claude Code Daemon

📊 Document Analysis:
  - Phases: 4
  - Code blocks: 12
  - Tasks: 25
  - Roles: 3

🎯 Starting Task Execution...

[1/25] Create project structure
  $ mkdir -p src tests config
  ✅ Success

[2/25] Install dependencies
  $ npm install axios cheerio sqlite3
  ✅ Success

[3/25] Execute bash code
  $ mkdir -p src tests config
  $ npm init -y
  $ npm install express
  ✅ Success

📈 Execution Summary:
  ✅ Successful: 25
  ❌ Failed: 0
  📊 Total: 25
```

## Interactive Mode Features

### Auto-Execution Mode
```
🤖 > /auto
✨ Auto-execution mode: ENABLED
📌 Commands will now execute immediately

🤖 > docker up
⚡ Auto-executing: docker up
  $ docker-compose up -d
  ✅ Containers started

🤖 > run tests
⚡ Auto-executing: run tests
  $ npm test
  ✅ All tests passed
```

### BMAD Document Execution
```
🤖 > /bmad
✅ BMAD document loaded successfully
📊 Document contains:
  - 4 phases
  - 12 code blocks

🤖 > execute
🚀 Executing BMAD Document...

[1/12] Execute bash code
  $ mkdir -p web3-audit-intelligence
  ✅ Success

[2/12] Install packages
  $ npm install axios cheerio
  ✅ Success
```

## Problem Solving Examples

### Automatic Fix Application
```
Task: npm start
Error: Cannot find module 'express'
🤖 Using Claude Daemon to solve...
💡 Claude suggests: npm install express
  $ npm install express
✅ Solution executed successfully
```

### Smart Defaults
```
Input: "start server"
Auto-fills: PORT=5000 NODE_ENV=development
Executes: PORT=5000 NODE_ENV=development npm start
```

## Configuration

### Claude Daemon Connection
```javascript
// Automatic connection and startup
daemonUrl: 'http://localhost:5001'

// If daemon is not running:
1. Starts Docker automatically
2. Launches daemon containers
3. Waits for healthy status
4. Continues execution
```

### Execution Settings
```javascript
{
  autoMode: true,           // Execute without confirmation
  claudeDaemon: true,       // Use Claude for problem-solving
  continueOnError: true,    // Don't stop on failures
  smartDefaults: true       // Auto-fill missing parameters
}
```

## Advanced Usage

### Custom Document Processing
```javascript
const BMADAutoExecutor = require('./src/bmad-auto-executor');

const executor = new BMADAutoExecutor('/path/to/document.md');
await executor.run();
```

### Programmatic Control
```javascript
const solver = new ClaudeInteractiveSolver();
solver.autoMode = true;
await solver.loadBMADDocument();
await solver.executeBMADDocument();
```

## Benefits

| Traditional | BMAD Auto-Executor |
|------------|-------------------|
| Copy each command manually | Executes all automatically |
| Stop on errors | Auto-solves problems |
| Ask for missing info | Uses smart defaults |
| Manual fixes | Claude provides solutions |
| Hours of setup | Minutes to complete |

## Tips

1. **Structure your BMAD documents** with clear code blocks
2. **Use numbered lists** for sequential tasks
3. **Include role definitions** for context
4. **Let Claude Daemon** handle errors automatically

## Summary

**No more copy-pasting commands!** The BMAD Auto-Executor reads your documentation and executes everything automatically, solving problems along the way with Claude's intelligence.

---

*Version 1.0.0 - Fully Automated Execution* 🚀