# Claude Code Daemon

A comprehensive monitoring and management system for Claude Code usage with real-time analytics, usage predictions, Slack integration, and seamless development workflow management using the BMAD-METHOD.

## ✨ Features

### 🔍 Core Monitoring & Analytics
- **Real-time Usage Monitoring**: Track Claude Code usage patterns, limits, and performance metrics
- **Predictive Analytics**: AI-powered predictions for usage limit management and optimization
- **System Health Monitoring**: CPU, memory, and performance metrics with real-time alerts
- **Advanced Logging**: Structured logging with rotation and real-time log streaming

### 📊 Interactive Web Dashboard
- **Modern Responsive Interface**: Real-time charts and visualizations with dark/light themes
- **Usage Analytics Page**: Comprehensive usage statistics and trend analysis
- **Alerts Management**: Visual alert management with real-time notifications
- **Project Management**: Interactive project workspace with terminal integration
- **System Logs Viewer**: Real-time log streaming with filtering and search
- **Slack Configuration**: Complete Slack integration setup and management interface

### 🚀 Project & Workspace Management
- **Interactive Workspace**: Full-featured development environment with terminal access
- **Project Creation & Management**: Create, configure, and manage multiple Claude Code projects
- **Terminal Integration**: Real-time terminal sessions with WebSocket streaming
- **Claude Code Integration**: Direct Claude Code execution and interaction from the dashboard
- **Night Mode Support**: Customizable dark/light theme preferences

### 💬 Slack Integration & Bot Control
- **Interactive Slack Bot**: Full-featured bot with slash commands and real-time notifications
- **Custom Channel Configuration**: Route different notification types to specific Slack channels
- **Slash Commands**: Control Claude Code and BMAD workflows directly from Slack
- **Real-time Notifications**: Project status updates, alerts, and system health notifications
- **Bot Management**: Complete Slack app configuration and credential management

### 🔗 BMAD-METHOD Integration
- **Seamless Workflow Integration**: Business, Marketing, Analysis, and Development agents
- **Automated Task Routing**: Route tasks to appropriate agents based on context
- **Workflow Templates**: Pre-built templates for common development scenarios
- **Progress Tracking**: Real-time workflow status and execution monitoring

### 🌐 API & Integration
- **RESTful API**: Complete API for external integrations and automation
- **WebSocket Support**: Real-time updates and bidirectional communication
- **Multi-channel Notifications**: Email, Slack, webhooks, and console notifications
- **External Service Integration**: Webhooks, email notifications, and third-party services

### 🔒 Security & Performance
- **JWT Authentication**: Secure authentication with configurable expiration
- **Rate Limiting**: API abuse prevention with configurable limits
- **CORS Protection**: Environment-specific origin controls
- **Input Validation**: Comprehensive sanitization and validation
- **Security Headers**: Helmet.js integration for security best practices

### 🐳 Deployment & DevOps
- **Docker Support**: Full containerization with Docker Compose
- **Automated Setup**: One-command setup scripts for quick deployment
- **Environment Management**: Multiple environment configurations (dev/staging/prod)
- **Health Checks**: Comprehensive health monitoring and status endpoints

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Claude Code** installed and configured
- **Docker** (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd claude-code-daemon

# Run the automated setup script
npm run setup

# Start development environment
npm run dev
```

### Manual Setup

```bash
# Install dependencies
npm install

# Create configuration files
cp .env.example .env

# Initialize database
npm run migrate

# Create sample data (optional)
npm run seed

# Start the application
npm run dev
```

## 📋 Available Commands

### Development
```bash
npm run dev          # Start API server with hot reload
npm run daemon       # Start daemon process
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint         # Check code quality
npm run lint:fix     # Fix linting issues automatically
npm run build        # Build project
```

### Docker
```bash
npm run docker:build # Build Docker image
npm run docker:run   # Start with Docker Compose
npm run docker:stop  # Stop Docker services
```

### Database
```bash
npm run migrate      # Run database migrations
npm run seed         # Create sample data
npm run backup       # Create database backup
```

### Utilities
```bash
npm run load-test    # Run load testing
npm run health-check # Check system health
```

## 🏗️ Architecture

### Core Components

- **Daemon Manager** (`src/daemon/manager.js`): Orchestrates all monitoring activities and scheduled tasks
- **Usage Monitor** (`src/daemon/usage-monitor.js`): Tracks Claude Code usage and generates predictions
- **API Server** (`src/api/server.js`): RESTful API and WebSocket server for dashboard communication
- **Web Dashboard** (`src/web/`): Real-time monitoring interface with interactive charts
- **Notification Service** (`src/daemon/notification-service.js`): Multi-channel alert system

### Technology Stack

- **Backend**: Node.js, Express.js, WebSockets
- **Database**: SQLite (development), PostgreSQL (production ready)
- **Frontend**: Vanilla JavaScript, Chart.js, WebSockets
- **Authentication**: JWT tokens, bcrypt password hashing
- **Deployment**: Docker, Docker Compose
- **Testing**: Jest, Supertest
- **Monitoring**: Winston logging, custom metrics

## 🔌 API Endpoints

### 📊 Dashboard Pages
```
GET    /                       # Main dashboard with overview
GET    /usage                  # Usage analytics page
GET    /alerts                 # Alerts management page
GET    /projects               # Project management interface
GET    /workspace              # Interactive workspace with terminal
GET    /logs                   # Real-time log viewer
GET    /slack-config           # Slack integration configuration
```

### 📈 Usage Monitoring
```
GET    /api/usage              # Get usage statistics
GET    /api/usage/current      # Get current usage
GET    /api/usage/predictions  # Get usage predictions
GET    /api/usage/history      # Get historical usage data
POST   /api/usage/manual       # Add manual usage entry
```

### 🖥️ System Management
```
GET    /api/system/status      # Get system status
GET    /api/system/health      # Health check endpoint
GET    /api/system/metrics     # Get system metrics
GET    /api/system/logs        # Get application logs
POST   /api/system/restart     # Restart services (dev only)
```

### 🚨 Alert Management
```
GET    /api/alerts             # Get all alerts
POST   /api/alerts             # Create new alert
PUT    /api/alerts/:id         # Update alert
DELETE /api/alerts/:id         # Delete alert
POST   /api/alerts/:id/test    # Test alert configuration
```

### 🚀 Project Management
```
GET    /api/projects           # Get all projects
POST   /api/projects           # Create new project
GET    /api/projects/:id       # Get project details
PUT    /api/projects/:id       # Update project
DELETE /api/projects/:id       # Delete project
POST   /api/projects/:id/start # Start Claude Code session
POST   /api/projects/:id/stop  # Stop Claude Code session
GET    /api/projects/:id/status # Get project status
POST   /api/projects/:id/terminal # Create terminal session
```

### 📝 Logs Management
```
GET    /api/logs               # Get system logs
GET    /api/logs/stream        # WebSocket log streaming
GET    /api/logs/download      # Download log files
POST   /api/logs/clear         # Clear log files
```

### 💬 Slack Integration
```
GET    /api/slack/status       # Get Slack connection status
POST   /api/slack/message      # Send custom message to Slack
PUT    /api/slack/channels     # Update channel configuration
GET    /api/slack/channels     # Get channel configuration
POST   /api/slack/test-alert   # Send test alert to Slack
GET    /api/slack/commands     # Get available Slack commands
POST   /api/slack/command      # Handle Slack slash commands
```

### 🔗 BMAD Integration
```
GET    /api/bmad/status        # Get BMAD workflow status
POST   /api/bmad/workflow/start # Start new workflow
GET    /api/bmad/workflow/:id  # Get workflow details
POST   /api/bmad/workflow/:id/stop # Stop workflow
GET    /api/bmad/agents        # Get available agents
POST   /api/bmad/execute       # Execute BMAD command
```

### 🌙 Theme Management
```
GET    /api/night-mode         # Get theme preferences
POST   /api/night-mode         # Set theme preferences
PUT    /api/night-mode         # Update theme settings
```

### 🔐 Authentication
```
POST   /api/auth/login         # User login
POST   /api/auth/logout        # User logout
GET    /api/auth/me            # Get current user
POST   /api/auth/change-password # Change password
POST   /api/auth/api-key       # Generate API key
```

## ⚙️ Configuration

Configuration is managed through JSON files in the `config/` directory and environment variables:

### Environment Variables (`.env`)
```bash
# Server Configuration
NODE_ENV=development
PORT=5000
DATABASE_PATH=./data/claude-daemon.db
LOG_LEVEL=debug

# Security
JWT_SECRET=your-secret-key-change-this-in-production
API_KEY_SECRET=your-api-key-secret-change-this
SKIP_AUTH=true  # Only for development
SESSION_SECRET=your-session-secret-change-this

# Slack Bot Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-user-oauth-token
SLACK_APP_TOKEN=xapp-your-app-level-token
SLACK_SIGNING_SECRET=your-signing-secret

# Slack Channel Configuration (Optional - defaults to #general)
SLACK_ALERTS_CHANNEL=#claude-alerts
SLACK_STATUS_CHANNEL=#claude-status
SLACK_COMMANDS_CHANNEL=#claude-control
SLACK_GENERAL_CHANNEL=#claude-general

# External Services
WEBHOOK_URL=
SLACK_WEBHOOK=
DISCORD_WEBHOOK=

# Email Configuration
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=

# BMAD Integration
BMAD_ENABLED=true
BMAD_WEBHOOK_SECRET=

# Claude Code Integration
CLAUDE_CODE_PATH=claude-code
CLAUDE_CODE_CONFIG_PATH=~/.config/claude-code

# Development Settings
DEBUG=claude-daemon:*
ENABLE_CORS=true
ENABLE_RATE_LIMITING=false

# Performance
MAX_REQUEST_SIZE=10mb
REQUEST_TIMEOUT=30000

# Features
ENABLE_WEBSOCKETS=true
ENABLE_METRICS=true
ENABLE_HEALTHCHECK=true
```

### Configuration Files
- `config/development.json` - Development environment settings
- `config/production.json` - Production environment settings
- `config/test.json` - Test environment settings

## 🐳 Docker Deployment

### Quick Start with Docker
```bash
# Build and start all services
docker-compose up -d

# Access the dashboard
open http://localhost:5000

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Docker Services
- **claude-daemon**: Main application container
- **redis**: Caching and session storage
- **nginx**: Reverse proxy and load balancer

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=integration
npm test -- --testPathPattern=e2e

# Run tests in watch mode
npm run test:watch
```

### Test Structure
```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for API endpoints
└── e2e/           # End-to-end tests for complete workflows
```

## 📊 Monitoring & Observability

The system provides comprehensive monitoring through multiple channels:

### 🖥️ Web Dashboard
- **Real-time charts** showing usage patterns and trends
- **Interactive project workspace** with terminal integration
- **System metrics** including CPU, memory, and performance
- **Alert management** with visual indicators and notifications
- **BMAD workflow** status and execution history
- **Slack integration configuration** and management interface
- **Real-time log streaming** with filtering and search capabilities
- **Dark/light theme** support with user preferences

### 💬 Slack Integration
- **Real-time notifications** for alerts, status changes, and system events
- **Interactive bot commands** for remote system control
- **Custom channel routing** for different notification types
- **Slash commands** for project management and system monitoring
- **Status updates** for Claude Code sessions and BMAD workflows
- **Health check notifications** and system alerts

### 📝 Advanced Logging
- **Structured logging** with Winston
- **Log levels**: error, warn, info, debug
- **Log rotation** with configurable retention
- **Real-time log streaming** via WebSocket
- **Security logging** for suspicious activities
- **Downloadable log files** for offline analysis

### 📈 Comprehensive Metrics
- **Usage statistics** with predictive analytics
- **System performance** monitoring
- **API endpoint** response times and error rates
- **WebSocket connection** health
- **Project session** tracking and analytics
- **Slack bot** interaction metrics

## 💬 Slack Integration

### 🚀 Interactive Bot Features
- **Slash Commands**: Control Claude Code and BMAD workflows directly from Slack
- **Real-time Notifications**: Get alerts, status updates, and project notifications
- **Custom Channel Routing**: Route different types of messages to specific channels
- **Interactive Commands**: Full remote control of the daemon from Slack

### 📋 Available Slack Commands
```
/claude-help                    # Show all available commands
/claude-status                  # Get system status and health
/claude-projects                # List all projects with status
/claude-start [project-name]    # Start Claude Code for project
/claude-stop [project-name]     # Stop Claude Code for project
/claude-bmad [project] [workflow] # Start BMAD workflow
/claude-logs [lines]            # Get recent logs (default: 10)
/claude-alerts                  # Get recent alerts
/claude-usage                   # Get usage statistics
/claude-health                  # Perform comprehensive health check
```

### 🔧 Quick Setup
1. **Create Slack App**: Visit [api.slack.com/apps](https://api.slack.com/apps)
2. **Configure Environment**: Set `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and `SLACK_SIGNING_SECRET`
3. **Create Channels**: Set up `#claude-alerts`, `#claude-status`, `#claude-control`, `#claude-general`
4. **Test Integration**: Use the web interface at `/slack-config` to test

### 📚 Full Documentation
For complete Slack setup instructions, see [docs/SLACK_INTEGRATION.md](docs/SLACK_INTEGRATION.md)

## 🔒 Security Features

- **JWT Authentication** with configurable expiration
- **Rate Limiting** to prevent API abuse
- **CORS Protection** with environment-specific origins
- **Input Validation** and sanitization
- **Security Headers** with Helmet.js
- **Audit Logging** for all administrative actions
- **Slack Request Verification** with signing secret validation

## 🔗 BMAD-METHOD Integration

The system seamlessly integrates with the BMAD-METHOD workflow:

- **Business Agent**: Requirements gathering and stakeholder management
- **Marketing Agent**: User experience and interface optimization
- **Analysis Agent**: Data analysis and performance monitoring
- **Development Agent**: Code implementation and technical execution

### BMAD Workflows
- **Automated task routing** to appropriate agents
- **Progress tracking** and status reporting
- **Real-time collaboration** between agents
- **Workflow templates** for common scenarios

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with appropriate tests
4. **Run the test suite**: `npm test`
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Submit a pull request**

### Development Guidelines
- Follow the existing code style and linting rules
- Write tests for new features and bug fixes
- Update documentation for API changes
- Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` directory for detailed guides
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions for questions and ideas

## 🗺️ Roadmap

### ✅ Completed (v1.0)
- [x] **Slack Integration**: Full interactive bot with slash commands
- [x] **Project Management**: Interactive workspace with terminal integration
- [x] **Real-time Dashboard**: Comprehensive monitoring interface
- [x] **Advanced Logging**: Real-time log streaming and management
- [x] **Theme Support**: Dark/light mode with user preferences
- [x] **Multi-channel Notifications**: Email, Slack, webhooks, console
- [x] **BMAD Integration**: Complete workflow management
- [x] **WebSocket Communication**: Real-time updates across all features

### Near Term (v1.1)
- [ ] **Discord Integration**: Extend bot functionality to Discord
- [ ] **Teams Integration**: Microsoft Teams bot support
- [ ] **Advanced Analytics**: ML-powered usage predictions and insights
- [ ] **Mobile App**: Native mobile app for monitoring
- [ ] **Plugin System**: Extensible architecture for custom integrations

### Medium Term (v1.2)
- [ ] **Multi-user Support**: Role-based access control and user management
- [ ] **Enterprise SSO**: SAML, OAuth, and LDAP integration
- [ ] **Advanced Reporting**: Automated reports and data exports
- [ ] **Performance Optimization**: Enhanced caching and optimization
- [ ] **AI Assistant**: ChatGPT/Claude integration for intelligent assistance

### Long Term (v2.0)
- [ ] **Distributed Deployment**: Multi-node cluster support
- [ ] **CI/CD Integration**: GitHub Actions, GitLab CI, Jenkins plugins
- [ ] **Advanced ML Insights**: Predictive analytics and anomaly detection
- [ ] **Enterprise Features**: Audit trails, compliance, and governance
- [ ] **Cloud Deployment**: AWS, Azure, GCP one-click deployments

---

## 🎯 Quick Start Guide

### 1. Installation & Setup
```bash
cd claude-code-daemon-dev
npm install
npm run setup              # Automated setup script
```

### 2. Start the System
```bash
npm start                  # Start the complete system
# OR start services individually:
npm run dev               # Start API server with hot reload
npm run daemon            # Start background daemon
```

### 3. Access the Dashboard
```bash
open http://localhost:5000
```

### 4. Available Interfaces
- **Main Dashboard**: `http://localhost:5000` - System overview
- **Usage Analytics**: `http://localhost:5000/usage` - Usage monitoring
- **Project Management**: `http://localhost:5000/projects` - Interactive workspace
- **Slack Configuration**: `http://localhost:5000/slack-config` - Bot setup
- **System Logs**: `http://localhost:5000/logs` - Real-time logs
- **Alerts Management**: `http://localhost:5000/alerts` - Alert configuration

### 5. Features Overview
✅ **Real-time Monitoring** - Usage analytics and system health
✅ **Interactive Workspace** - Terminal integration and project management
✅ **Slack Bot Integration** - Remote control via Slack commands
✅ **Multi-channel Notifications** - Email, Slack, webhooks
✅ **BMAD Workflow Management** - Complete development workflow support
✅ **Advanced Logging** - Real-time log streaming and analysis
✅ **Dark/Light Themes** - Customizable interface preferences

**Made with ❤️ for the Claude Code community**