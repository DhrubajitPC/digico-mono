#!/usr/bin/env bash

# Digico Lean Production Deployment Script (RHEL / Enterprise Linux Compatible)
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
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    docker compose up -d --build
elif command -v docker-compose &>/dev/null; then
    docker-compose up -d --build
elif command -v podman-compose &>/dev/null; then
    podman-compose up -d --build
else
    echo "[!] Error: Neither 'docker compose' nor 'podman-compose' was found."
    exit 1
fi

# 3. Verify status
echo "[2/2] Checking container health..."
sleep 3
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    docker compose ps
elif command -v podman-compose &>/dev/null; then
    podman-compose ps
fi

echo "========================================="
echo "   SUCCESS: Digico Container Deploy Complete!"
echo "========================================="
echo "   Frontend Web App: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP'):5173"
echo "   Backend REST API: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP'):8787/health"
echo "========================================="
