#!/usr/bin/env bash
# ==============================================================================
# Digico — Enterprise Linux 10 (RHEL / AlmaLinux / Rocky / CentOS) Setup Script
# ==============================================================================
# Run as root: bash server-setup-el10.sh
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting Enterprise Linux 10 Server Setup & Hardening..."
echo "=========================================================="

# 1. Update Package Index
echo "[1/8] Updating system packages..."
dnf update -y

# 2. Create Deploy User
echo "[2/8] Setting up 'deploy' user..."
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash deploy
    usermod -aG wheel deploy
    echo "Created user 'deploy'."
fi

# Copy SSH key if present
if [ -d "/root/.ssh" ]; then
    mkdir -p /home/deploy/.ssh
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
fi

# 3. Apply SSH Hardening
echo "[3/8] Applying SSH hardening parameters..."
cat << 'EOF' > /etc/ssh/sshd_config.d/50-security.conf
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

sshd -t && systemctl restart sshd

# 4. Configure Firewalld
echo "[4/8] Configuring firewalld network rules..."
dnf install -y firewalld
systemctl enable --now firewalld

firewall-cmd --permanent --add-service=ssh || true
firewall-cmd --permanent --add-service=http || true
firewall-cmd --permanent --add-service=https || true
firewall-cmd --reload

# 5. Fail2ban & Auto Updates
echo "[5/8] Installing Fail2ban and security auto-updates..."
dnf install -y epel-release
dnf install -y fail2ban dnf-automatic

systemctl enable --now dnf-automatic.timer
systemctl enable --now fail2ban

# 6. Kernel Sysctl Parameters
echo "[6/8] Setting kernel sysctl security parameters..."
cat << 'EOF' > /etc/sysctl.d/99-security.conf
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
EOF

sysctl -p /etc/sysctl.d/99-security.conf

# 7. Install Docker CE, containerd, & iptables-nft
echo "[7/8] Installing Docker CE, containerd, & iptables compatibility..."
dnf install -y dnf-plugins-core iptables-nft
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Configure Docker Daemon for Enterprise Linux 10
mkdir -p /etc/docker
cat << 'EOF' > /etc/docker/daemon.json
{
  "exec-opts": ["native.cgroupdriver=systemd"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m"
  },
  "storage-driver": "overlay2"
}
EOF

# Start containerd first, then docker daemon
systemctl daemon-reload
systemctl enable --now containerd
systemctl enable --now docker
usermod -aG docker deploy

# 8. Setup App Directory
echo "[8/8] Preparing /opt/digico deployment directory..."
mkdir -p /opt/digico
chown -R deploy:deploy /opt/digico

echo "=========================================================="
echo " SUCCESS: Server setup & hardening complete!"
echo " Next steps:"
echo " 1. Set password for deploy user: passwd deploy"
echo " 2. Log in as deploy: su - deploy"
echo " 3. Navigate to /opt/digico and clone project codebase"
echo " 4. Configure .env and execute ./deploy.sh"
echo "=========================================================="
