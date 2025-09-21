#!/bin/bash

# BMAD Auto-Executor Launcher
# Automatically executes BMAD Method documents

echo "🚀 BMAD Auto-Executor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

# Check if axios is installed
if [ ! -d "node_modules/axios" ]; then
    echo "📦 Installing dependencies..."
    npm install axios
fi

# Default BMAD document
BMAD_DOC="/Volumes/Extreme SSD/Workspace/claude-code-daemon/claude-code-daemon-dev/BMAD_METHOD_GUIDE.md"

# Check if custom document is provided
if [ ! -z "$1" ]; then
    BMAD_DOC="$1"
fi

# Check if document exists
if [ ! -f "$BMAD_DOC" ]; then
    echo "❌ Document not found: $BMAD_DOC"
    exit 1
fi

echo "📄 Document: $BMAD_DOC"
echo "━━━━━━━━━━━━━━━━━━━━━━━━"

# Run the auto-executor
node src/bmad-auto-executor.js "$BMAD_DOC"