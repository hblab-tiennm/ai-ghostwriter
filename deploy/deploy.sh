#!/bin/bash
# ============================================================================
# AI Ghostwriter — Deploy / Redeploy Script
# Run from project root: bash deploy/deploy.sh
# ============================================================================

set -euo pipefail

APP_DIR="/root/project/ai-ghostwriter"
cd "$APP_DIR"

echo "══════════════════════════════════════════════════════"
echo "  AI Ghostwriter — Deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════════════"

# ── 1. Pull latest code ────────────────────────────────────
echo ""
echo "→ [1/6] Pulling latest code..."
git pull origin main

# ── 2. Build MCP Server ────────────────────────────────────
echo ""
echo "→ [2/6] Building MCP Server..."
cd "$APP_DIR/mcp-server"
npm ci --omit=dev
npm run build

# ── 3. Build Web App ───────────────────────────────────────
echo ""
echo "→ [3/6] Building Web App..."
cd "$APP_DIR/web-app"
npm ci
npm run build

# ── 4. Setup Nginx (if first deploy) ──────────────────────
echo ""
echo "→ [4/6] Checking Nginx config..."
NGINX_CONF="/etc/nginx/sites-available/vy.tien.dev"
if [ ! -f "$NGINX_CONF" ]; then
    echo "  → Installing Nginx config..."
    cp "$APP_DIR/deploy/nginx/vy.tien.dev.conf" "$NGINX_CONF"
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/vy.tien.dev
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo "  ✅ Nginx configured"
else
    echo "  ✓ Nginx config already exists"
fi

# ── 5. Start/Restart PM2 ──────────────────────────────────
echo ""
echo "→ [5/6] Starting services with PM2..."
cd "$APP_DIR"
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save

# ── 6. Health check ────────────────────────────────────────
echo ""
echo "→ [6/6] Health check..."
sleep 3

MCP_OK=$(curl -sf http://localhost:3001/health | grep -c '"ok"' || true)
WEB_OK=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000 || true)

if [ "$MCP_OK" -ge 1 ]; then
    echo "  ✅ MCP Server: healthy"
else
    echo "  ❌ MCP Server: NOT responding"
    echo "     Check: pm2 logs mcp-server"
fi

if [ "$WEB_OK" = "200" ]; then
    echo "  ✅ Web App: healthy (HTTP $WEB_OK)"
else
    echo "  ❌ Web App: NOT responding (HTTP $WEB_OK)"
    echo "     Check: pm2 logs web-app"
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Deploy complete!"
echo "  → https://vy.tien.dev"
echo "  → https://vy.tien.dev/mcp/health"
echo "══════════════════════════════════════════════════════"
