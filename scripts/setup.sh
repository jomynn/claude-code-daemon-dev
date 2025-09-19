#!/bin/bash

# Claude Code Daemon Development Project Setup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

log_header() {
    echo -e "${CYAN}
========================================
$1
========================================${NC}"
}

# Configuration
PROJECT_NAME="Claude Code Daemon"
NODE_MIN_VERSION="18.0.0"
NPM_MIN_VERSION="8.0.0"

# Start setup
log_header "🚀 Setting up $PROJECT_NAME Development Project"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Function to compare versions
version_compare() {
    local version1=$1
    local version2=$2

    if [ "$(printf '%s\n' "$version1" "$version2" | sort -V | head -n1)" = "$version2" ]; then
        return 0 # version1 >= version2
    else
        return 1 # version1 < version2
    fi
}

# Check prerequisites
log_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is required but not installed"
    log_info "Please install Node.js ${NODE_MIN_VERSION} or higher from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -c 2-)
if ! version_compare "$NODE_VERSION" "$NODE_MIN_VERSION"; then
    log_error "Node.js version $NODE_VERSION is too old. Minimum required: $NODE_MIN_VERSION"
    exit 1
fi
log_success "Node.js $NODE_VERSION ✓"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is required but not installed"
    exit 1
fi

NPM_VERSION=$(npm --version)
if ! version_compare "$NPM_VERSION" "$NPM_MIN_VERSION"; then
    log_error "npm version $NPM_VERSION is too old. Minimum required: $NPM_MIN_VERSION"
    exit 1
fi
log_success "npm $NPM_VERSION ✓"

# Check optional dependencies
if ! command -v docker &> /dev/null; then
    log_warning "Docker not found - Docker-related features will not be available"
else
    log_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') ✓"
fi

if ! command -v git &> /dev/null; then
    log_warning "Git not found - Version control features will not be available"
else
    log_success "Git $(git --version | cut -d' ' -f3) ✓"
fi

# Create project directories
log_step "Creating project directory structure..."

DIRECTORIES=(
    "data"
    "logs"
    "temp"
    "backup"
    "config"
    "src/daemon"
    "src/api/routes"
    "src/api/middleware"
    "src/database/models"
    "src/database/migrations"
    "src/web/public/css"
    "src/web/public/js"
    "src/web/public/assets"
    "src/web/views"
    "src/services"
    "src/utils"
    "tests/unit"
    "tests/integration"
    "tests/e2e"
    "docs"
    "tools"
    ".github/workflows"
)

for dir in "${DIRECTORIES[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        log_info "Created directory: $dir"
    fi
done

log_success "Directory structure created"

# Install dependencies
log_step "Installing npm dependencies..."

if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

log_success "Dependencies installed"

# Create environment configuration
log_step "Creating configuration files..."

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# Environment Configuration
NODE_ENV=development
PORT=5000
DATABASE_PATH=./data/claude-daemon.db
LOG_LEVEL=debug

# Security
JWT_SECRET=your-secret-key-change-this-in-production
API_KEY_SECRET=your-api-key-secret-change-this

# Authentication
SKIP_AUTH=true
SESSION_SECRET=your-session-secret-change-this

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
EOF
    log_success "Created .env file"
else
    log_warning ".env file already exists, skipping creation"
fi

# Create development configuration
if [ ! -f "config/development.json" ]; then
    cat > config/development.json << 'EOF'
{
  "database": {
    "path": "./data/claude-daemon.db",
    "backup": true,
    "backupInterval": "1h",
    "maxBackups": 24
  },
  "monitoring": {
    "interval": 300,
    "warningThreshold": 80,
    "criticalThreshold": 95,
    "enablePredictions": true,
    "predictionWindow": "24h"
  },
  "logging": {
    "level": "debug",
    "file": "./logs/development.log",
    "maxSize": "10mb",
    "maxFiles": 5,
    "enableConsole": true
  },
  "server": {
    "port": 5000,
    "host": "localhost",
    "cors": {
      "origin": "*",
      "credentials": true
    },
    "rateLimit": {
      "enabled": false,
      "windowMs": 900000,
      "max": 100
    }
  },
  "websocket": {
    "enabled": true,
    "port": 5001,
    "pingInterval": 25000,
    "pingTimeout": 5000
  },
  "cleanup": {
    "retentionDays": 30,
    "autoCleanup": true,
    "cleanupInterval": "24h"
  },
  "notifications": {
    "enabled": true,
    "channels": ["console", "file"],
    "cooldown": 300
  },
  "features": {
    "bmadIntegration": true,
    "usagePredictions": true,
    "realTimeUpdates": true,
    "apiKeyAuth": true
  }
}
EOF
    log_success "Created development configuration"
fi

# Create production configuration
if [ ! -f "config/production.json" ]; then
    cat > config/production.json << 'EOF'
{
  "database": {
    "path": "/data/claude-daemon.db",
    "backup": true,
    "backupInterval": "6h",
    "maxBackups": 14
  },
  "monitoring": {
    "interval": 300,
    "warningThreshold": 80,
    "criticalThreshold": 95,
    "enablePredictions": true,
    "predictionWindow": "24h"
  },
  "logging": {
    "level": "info",
    "file": "/app/logs/production.log",
    "maxSize": "50mb",
    "maxFiles": 10,
    "enableConsole": false
  },
  "server": {
    "port": 5000,
    "host": "0.0.0.0",
    "cors": {
      "origin": false,
      "credentials": true
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 900000,
      "max": 100
    }
  },
  "websocket": {
    "enabled": true,
    "port": 5001,
    "pingInterval": 25000,
    "pingTimeout": 5000
  },
  "cleanup": {
    "retentionDays": 90,
    "autoCleanup": true,
    "cleanupInterval": "12h"
  },
  "notifications": {
    "enabled": true,
    "channels": ["email", "webhook", "file"],
    "cooldown": 600
  },
  "features": {
    "bmadIntegration": true,
    "usagePredictions": true,
    "realTimeUpdates": true,
    "apiKeyAuth": true
  }
}
EOF
    log_success "Created production configuration"
fi

# Create test configuration
if [ ! -f "config/test.json" ]; then
    cat > config/test.json << 'EOF'
{
  "database": {
    "path": ":memory:",
    "backup": false
  },
  "monitoring": {
    "interval": 60,
    "warningThreshold": 80,
    "criticalThreshold": 95,
    "enablePredictions": false
  },
  "logging": {
    "level": "error",
    "file": "./logs/test.log",
    "enableConsole": false
  },
  "server": {
    "port": 0,
    "cors": {
      "origin": true
    }
  },
  "cleanup": {
    "retentionDays": 1,
    "autoCleanup": false
  },
  "notifications": {
    "enabled": false
  },
  "features": {
    "bmadIntegration": false,
    "usagePredictions": false,
    "realTimeUpdates": false,
    "apiKeyAuth": false
  }
}
EOF
    log_success "Created test configuration"
fi

# Initialize database
log_step "Initializing database..."

if command -v npm run migrate &> /dev/null; then
    if npm run migrate; then
        log_success "Database initialized"
    else
        log_warning "Database migration failed - will attempt during first run"
    fi
else
    log_warning "Migration script not available - database will be initialized on first run"
fi

# Create sample data
log_step "Creating sample data..."

if command -v npm run seed &> /dev/null; then
    if npm run seed; then
        log_success "Sample data created"
    else
        log_warning "Sample data creation failed - skipping"
    fi
else
    log_warning "Seed script not available - no sample data created"
fi

# Set up Git hooks (if Git is available and repository exists)
if command -v git &> /dev/null && [ -d ".git" ]; then
    log_step "Setting up Git hooks..."

    # Pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."

# Run linter
if npm run lint; then
    echo "✅ Linting passed"
else
    echo "❌ Linting failed"
    exit 1
fi

# Run tests
if npm test; then
    echo "✅ Tests passed"
else
    echo "❌ Tests failed"
    exit 1
fi

echo "✅ Pre-commit checks passed"
EOF

    chmod +x .git/hooks/pre-commit
    log_success "Git hooks configured"
fi

# Build project
log_step "Building project..."

if npm run build; then
    log_success "Project built successfully"
else
    log_warning "Build failed - some features may not work correctly"
fi

# Final verification
log_step "Performing final verification..."

# Check if key files exist
KEY_FILES=(
    "src/daemon/manager.js"
    "src/api/server.js"
    "src/api/routes/usage.js"
    "src/api/routes/alerts.js"
    "src/api/routes/system.js"
    "src/api/routes/bmad.js"
    "src/api/middleware/auth.js"
    "src/api/middleware/cors.js"
    "src/api/middleware/logging.js"
    "config/development.json"
    "config/production.json"
    ".env"
)

MISSING_FILES=()
for file in "${KEY_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    log_success "All required files are present"
else
    log_warning "Some files are missing:"
    for file in "${MISSING_FILES[@]}"; do
        log_error "  - $file"
    done
fi

# Create startup scripts
log_step "Creating startup scripts..."

# Development startup script
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "Starting Claude Code Daemon in development mode..."

# Set environment
export NODE_ENV=development

# Start API server in background
echo "Starting API server..."
npm run dev &
API_PID=$!

# Start daemon
echo "Starting daemon..."
npm run daemon &
DAEMON_PID=$!

# Wait for interrupt
echo "Services started. Press Ctrl+C to stop."
echo "API Server PID: $API_PID"
echo "Daemon PID: $DAEMON_PID"

trap "echo 'Stopping services...'; kill $API_PID $DAEMON_PID; exit" INT

wait
EOF

chmod +x start-dev.sh

# Production startup script
cat > start-prod.sh << 'EOF'
#!/bin/bash
echo "Starting Claude Code Daemon in production mode..."

# Set environment
export NODE_ENV=production

# Start API server in background
echo "Starting API server..."
npm start &
API_PID=$!

# Start daemon
echo "Starting daemon..."
npm run daemon &
DAEMON_PID=$!

# Create PID file
echo $API_PID > ./data/api.pid
echo $DAEMON_PID > ./data/daemon.pid

echo "Services started."
echo "API Server PID: $API_PID (saved to ./data/api.pid)"
echo "Daemon PID: $DAEMON_PID (saved to ./data/daemon.pid)"
EOF

chmod +x start-prod.sh

log_success "Startup scripts created"

# Setup completion
log_header "🎉 Setup completed successfully!"

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Review and update the .env file with your specific configuration"
echo "2. Start development server: ${CYAN}npm run dev${NC} or ${CYAN}./start-dev.sh${NC}"
echo "3. Start daemon: ${CYAN}npm run daemon${NC}"
echo "4. Open dashboard: ${CYAN}http://localhost:5000${NC}"
echo "5. Run tests: ${CYAN}npm test${NC}"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo "• ${CYAN}npm run dev${NC}        - Start API server with auto-reload"
echo "• ${CYAN}npm run daemon${NC}     - Start daemon process"
echo "• ${CYAN}npm test${NC}           - Run test suite"
echo "• ${CYAN}npm run lint${NC}       - Check code quality"
echo "• ${CYAN}npm run build${NC}      - Build project"
echo "• ${CYAN}npm run docker:run${NC} - Start with Docker Compose"
echo ""
echo -e "${BLUE}Docker commands:${NC}"
echo "• ${CYAN}npm run docker:build${NC} - Build Docker image"
echo "• ${CYAN}npm run docker:run${NC}   - Start with Docker Compose"
echo "• ${CYAN}npm run docker:stop${NC}  - Stop Docker services"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "• Update the JWT_SECRET in .env before deploying to production"
echo "• Configure external services (email, webhooks) in .env if needed"
echo "• Review security settings in config files for production deployment"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"