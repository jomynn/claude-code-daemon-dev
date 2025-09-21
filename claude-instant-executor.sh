#!/bin/bash

# Claude Instant Executor - Builds projects immediately from BMAD documents
# No questions, no recommendations, just BUILD

echo "⚡ CLAUDE INSTANT EXECUTOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if BMAD document exists
BMAD_DOC="${1:-BMAD_METHOD_GUIDE.md}"

if [ ! -f "$BMAD_DOC" ]; then
    echo "❌ Document not found: $BMAD_DOC"
    exit 1
fi

echo "📄 Processing: $BMAD_DOC"
echo ""

# Execute immediately
node claude-bmad-executor.js

echo ""
echo "✅ EXECUTION COMPLETE"
echo ""
echo "Your project is built and ready at: web3-audit-intelligence/"
echo ""
echo "Start it with:"
echo "  cd web3-audit-intelligence"
echo "  source venv/bin/activate"
echo "  python run.py"