#!/bin/bash
# ============================================================================
# AI Ghostwriter — Server Setup Script
# Run this ONCE on a fresh Ubuntu 22.04+ VPS
# Usage: ssh root@<IP> 'bash -s' < deploy/setup-server.sh
# ============================================================================

set -euo pipefail

echo "══════════════════════════════════════════════════════"
echo "  AI Ghostwriter — Server Setup"
echo "══════════════════════════════════════════════════════"

# ── 1. System update ────────────────────────────────────────
echo "→ Updating system..."
apt update && apt upgrade -y

# ── 2. Node.js 20 ──────────────────────────────────────────
echo "→ Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "  Node: $(node -v), npm: $(npm -v)"

# ── 3. PM2 ─────────────────────────────────────────────────
echo "→ Installing PM2..."
npm install -g pm2

# ── 4. Nginx ───────────────────────────────────────────────
echo "→ Installing Nginx..."
apt install -y nginx
systemctl enable nginx

# ── 5. Create app directory ────────────────────────────────
echo "→ Creating /var/www/ai-ghostwriter..."
mkdir -p /var/www/ai-ghostwriter
mkdir -p /var/log/pm2

# ── 6. Firewall (ufw) ─────────────────────────────────────
echo "→ Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ Server setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Clone repo to /var/www/ai-ghostwriter"
echo "    2. Run: bash deploy/deploy.sh"
echo "══════════════════════════════════════════════════════"
