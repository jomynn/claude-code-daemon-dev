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
