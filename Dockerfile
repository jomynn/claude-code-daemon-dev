FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S daemon -u 1001

# Copy application code
COPY --chown=daemon:nodejs . .

# Create directories
RUN mkdir -p /data /app/logs && \
    chown -R daemon:nodejs /data /app/logs

# Switch to non-root user
USER daemon

# Expose ports
EXPOSE 5000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node tools/health-check.js

# Start application
CMD ["npm", "start"]