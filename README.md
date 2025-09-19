# Claude Code Daemon

A comprehensive monitoring and management system for Claude Code usage with real-time analytics, usage predictions, and seamless integration with development workflows using the BMAD-METHOD.

## ✨ Features

- **🔍 Real-time Usage Monitoring**: Track Claude Code usage patterns, limits, and performance metrics
- **🤖 Predictive Analytics**: AI-powered predictions for usage limit management and optimization
- **📊 Web Dashboard**: Modern, responsive interface with real-time charts and visualizations
- **🔗 BMAD-METHOD Integration**: Seamless workflow integration with Business, Marketing, Analysis, and Development agents
- **🌐 RESTful API**: Complete API for external integrations and automation
- **⚡ WebSocket Support**: Real-time updates and notifications
- **🐳 Docker Support**: Easy deployment with containerization
- **🧪 Comprehensive Testing**: Unit, integration, and end-to-end tests
- **📈 Performance Monitoring**: System health checks and performance metrics
- **🔒 Security**: JWT authentication, rate limiting, and CORS protection

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

### Usage Monitoring
```
GET    /api/usage              # Get usage statistics
GET    /api/usage/current      # Get current usage
GET    /api/usage/predictions  # Get usage predictions
GET    /api/usage/history      # Get historical usage data
POST   /api/usage/manual       # Add manual usage entry
```

### System Management
```
GET    /api/system/status      # Get system status
GET    /api/system/health      # Health check endpoint
GET    /api/system/metrics     # Get system metrics
GET    /api/system/logs        # Get application logs
POST   /api/system/restart     # Restart services (dev only)
```

### Alert Management
```
GET    /api/alerts             # Get all alerts
POST   /api/alerts             # Create new alert
PUT    /api/alerts/:id         # Update alert
DELETE /api/alerts/:id         # Delete alert
POST   /api/alerts/:id/test    # Test alert configuration
```

### BMAD Integration
```
GET    /api/bmad/status        # Get BMAD workflow status
POST   /api/bmad/workflow/start # Start new workflow
GET    /api/bmad/workflow/:id  # Get workflow details
POST   /api/bmad/workflow/:id/stop # Stop workflow
GET    /api/bmad/agents        # Get available agents
POST   /api/bmad/execute       # Execute BMAD command
```

### Authentication
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
NODE_ENV=development
PORT=5000
DATABASE_PATH=./data/claude-daemon.db
LOG_LEVEL=debug

# Security
JWT_SECRET=your-secret-key-change-this-in-production
SKIP_AUTH=true  # Only for development

# External Services
WEBHOOK_URL=
SLACK_WEBHOOK=
EMAIL_HOST=
EMAIL_USER=
EMAIL_PASS=

# BMAD Integration
BMAD_ENABLED=true
BMAD_WEBHOOK_SECRET=
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

The system provides comprehensive monitoring through:

### Web Dashboard
- **Real-time charts** showing usage patterns and trends
- **System metrics** including CPU, memory, and performance
- **Alert management** with visual indicators and notifications
- **BMAD workflow** status and execution history

### Logging
- **Structured logging** with Winston
- **Log levels**: error, warn, info, debug
- **Log rotation** with configurable retention
- **Security logging** for suspicious activities

### Metrics
- **Usage statistics** with predictive analytics
- **System performance** monitoring
- **API endpoint** response times and error rates
- **WebSocket connection** health

## 🔒 Security Features

- **JWT Authentication** with configurable expiration
- **Rate Limiting** to prevent API abuse
- **CORS Protection** with environment-specific origins
- **Input Validation** and sanitization
- **Security Headers** with Helmet.js
- **Audit Logging** for all administrative actions

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

### Near Term (v1.1)
- [ ] Advanced usage prediction algorithms
- [ ] Integration with more external services
- [ ] Enhanced dashboard customization
- [ ] Mobile-responsive improvements

### Medium Term (v1.2)
- [ ] Multi-user support with role-based access
- [ ] Advanced reporting and analytics
- [ ] Plugin system for extensibility
- [ ] Performance optimization

### Long Term (v2.0)
- [ ] Distributed deployment support
- [ ] Advanced ML-based insights
- [ ] Integration with CI/CD pipelines
- [ ] Enterprise features

---
  🎯 Project is Complete and Ready to Use!

  To get started:
  cd claude-code-daemon-dev
  chmod +x scripts/setup.sh
  npm run setup
  npm run dev    # Start API server
  npm run daemon # Start background daemon

  The project now provides a comprehensive monitoring and management
  system for Claude Code usage with advanced analytics, real-time alerts,
  and seamless BMAD-METHOD integration.

  
**Made with ❤️ for the Claude Code community**