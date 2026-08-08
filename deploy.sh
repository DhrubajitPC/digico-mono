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
OPENAI_API_KEY=${OPENAI_API_KEY:-}
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
EOF
    echo "[+] Created production .env file."
fi

# 2. Build and launch containers
echo "[1/2] Building and starting Docker containers..."
docker compose up -d --build

# 3. Verify status
echo "[2/2] Checking container health..."
sleep 3
docker compose ps

echo "========================================="
echo "   SUCCESS: Digico Container Deploy Complete!"
echo "========================================="
echo "   Frontend Web App: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP'):5173"
echo "   Backend REST API: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP'):8787/health"
echo "========================================="
