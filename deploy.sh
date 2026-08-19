#!/usr/bin/env bash

# Digico Lean Docker Production Deployment Script
set -euo pipefail

echo "========================================="
echo "   Digico Production Container Setup"
echo "========================================="

# 1. Environment variables check
if [ ! -f .env ]; then
    echo "[!] .env file not found. Creating default template..."
    cat <<EOF > .env
PORT=8787
NODE_ENV=production
WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 16 2>/dev/null || echo "digico_secret_$(date +%s)")
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-}
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
MARIADB_USER=${MARIADB_USER:-wp}
MARIADB_PASSWORD=${MARIADB_PASSWORD:-wp}
MARIADB_DATABASE=${MARIADB_DATABASE:-woocommerce_local}
EOF
    echo "[+] Created production .env file."
fi

# 2. MariaDB Seed Directory Setup
mkdir -p data/mariadb-init
if [ -f export.sql ] && [ ! -f data/mariadb-init/export.sql ]; then
    echo "[+] Linking export.sql into data/mariadb-init/ for container database seed..."
    cp -s "$(pwd)/export.sql" data/mariadb-init/export.sql 2>/dev/null || cp export.sql data/mariadb-init/export.sql || true
fi

# 3. Build and launch containers
echo "[1/2] Building and starting Docker containers..."
make docker-up

# 4. Verify status
echo "[2/2] Checking container status..."
make docker-ps

echo "========================================="
echo "   SUCCESS: Digico Container Deploy Complete!"
echo "========================================="
echo "   Frontend Web App: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP'):5173"
echo "   Backend REST API: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP'):8787/health"
echo "========================================="
