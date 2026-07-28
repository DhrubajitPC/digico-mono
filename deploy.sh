#!/usr/bin/env bash

# Digico Automated Server Deployment Script
set -euo pipefail

echo "========================================="
echo "   Digico Automated Production Setup"
echo "========================================="

# 1. Update packages and install Docker + Git
echo "[1/5] Installing system prerequisites (Docker, Git, UFW)..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git make ufw

if ! command -v docker &> /dev/null; then
    echo "Installing Docker Engine..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER" || true
fi

# Enable Docker on boot
sudo systemctl enable --now docker

# 2. Firewall configuration
echo "[2/5] Hardening UFW firewall..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 5173/tcp || true
sudo ufw allow 8787/tcp || true
sudo ufw --force enable || true

# 3. Setup environment variables
echo "[3/5] Setting up production .env secrets..."
if [ ! -f .env ]; then
    cat <<EOF > .env
PORT=8787
NODE_ENV=production
WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 16 2>/dev/null || echo "digico_secret_$(date +%s)")
OPENAI_API_KEY=${OPENAI_API_KEY:-}
EOF
    echo "Created production .env file with generated secrets."
fi

# 4. Build and launch containers
echo "[4/5] Building and launching production Docker containers..."
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    docker compose up -d --build
else
    make docker-up
fi

# 5. Verify Health
echo "[5/5] Checking container status..."
sleep 5
docker compose ps

echo "========================================="
echo "   SUCCESS: Digico Deployment Complete!"
echo "========================================="
echo "   Frontend Web App: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):5173"
echo "   Backend REST API: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):8787/api/orders"
echo "========================================="
