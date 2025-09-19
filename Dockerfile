FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    wget

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S claudeuser -u 1001 -G nodejs

# Copy application code
COPY --chown=claudeuser:nodejs . .

# Create directories
RUN mkdir -p /data /app/logs && \
    chown -R claudeuser:nodejs /data /app/logs

# Switch to non-root user
USER claudeuser

# Expose ports
EXPOSE 5000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node tools/health-check.js

# Start application
CMD ["npm", "start"]