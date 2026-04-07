#!/bin/bash
# Generates .claude/mcp.json with absolute paths for the ghostwriter MCP server.
# Run once after building the MCP server.
#
# Usage:
#   OPENAI_API_KEY=sk-... bash .claude/setup-mcp-config.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MCP_SERVER="$PROJECT_DIR/mcp-server/dist/index.js"
CHROMA_PATH="$PROJECT_DIR/chroma-data"
DATASET_PATH="$PROJECT_DIR/dataset"
OUTPUT="$PROJECT_DIR/.claude/mcp.json"

# Validate MCP server is built
if [ ! -f "$MCP_SERVER" ]; then
  echo "❌ MCP server not built. Run: cd mcp-server && npm run build"
  exit 1
fi

# Use OPENAI_API_KEY from env or prompt
API_KEY="${OPENAI_API_KEY:-REPLACE_WITH_YOUR_OPENAI_API_KEY}"

cat > "$OUTPUT" << EOF
{
  "mcpServers": {
    "ghostwriter": {
      "command": "node",
      "args": ["$MCP_SERVER"],
      "env": {
        "OPENAI_API_KEY": "$API_KEY",
        "CHROMA_DB_PATH": "$CHROMA_PATH",
        "DATASET_PATH": "$DATASET_PATH"
      }
    }
  }
}
EOF

echo "✓ Created .claude/mcp.json"
echo "  MCP server: $MCP_SERVER"
echo "  ChromaDB:   $CHROMA_PATH"
echo "  Dataset:    $DATASET_PATH"

if [ "$API_KEY" = "REPLACE_WITH_YOUR_OPENAI_API_KEY" ]; then
  echo ""
  echo "⚠️  Remember to set your OPENAI_API_KEY in .claude/mcp.json"
fi
