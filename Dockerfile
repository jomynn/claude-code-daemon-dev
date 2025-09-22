FROM node:18-alpine

# Enhanced Claude Code Daemon v2.0 with BMAD Auto-Execution
LABEL version="2.0.0" \
      description="Claude Code Daemon with BMAD Auto-Execution capabilities" \
      maintainer="Claude Code Team"

# Install enhanced system dependencies for BMAD execution
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    sqlite \
    postgresql-client \
    wget \
    curl \
    git \
    bash \
    chromium \
    chromium-chromedriver \
    zip \
    unzip \
    tar \
    gzip

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including new BMAD dependencies)
RUN npm ci --include=dev

# Create non-root user with enhanced permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S claudeuser -u 1001 -G nodejs && \
    adduser claudeuser wheel

# Copy application code with proper ownership
COPY --chown=claudeuser:nodejs . .

# Create enhanced directory structure for BMAD execution
RUN mkdir -p \
    /data \
    /app/logs \
    /app/generated-projects \
    /app/bmad-cache \
    /app/execution-logs \
    /app/temp \
    /app/backups && \
    chown -R claudeuser:nodejs /data /app

# Set executable permissions for scripts
RUN chmod +x claude-instant-executor.sh && \
    chmod +x run-bmad.sh && \
    chmod +x src/claude-interactive-solver.js && \
    chmod +x claude-bmad-executor.js

# Install Python dependencies for project generation
RUN pip3 install --break-system-packages --no-cache-dir \
    requests \
    beautifulsoup4 \
    jinja2 \
    pyyaml

# Set environment variables for enhanced features
ENV NODE_ENV=production \
    BMAD_EXECUTION_ENABLED=true \
    AUTO_PROJECT_GENERATION=true \
    CLAUDE_ENHANCED_MODE=true \
    CHROMIUM_PATH=/usr/bin/chromium-browser \
    PROJECT_GENERATION_PATH=/app/generated-projects

# Switch to non-root user
USER claudeuser

# Expose enhanced ports
EXPOSE 5000 5001 8080 9000

# Enhanced health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Set executable permissions for startup script
RUN chmod +x scripts/start-with-database.js

# Start application with database support
CMD ["node", "scripts/start-with-database.js"]