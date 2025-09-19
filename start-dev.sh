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
