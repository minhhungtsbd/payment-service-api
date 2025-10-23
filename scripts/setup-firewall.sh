#!/bin/bash

# iptables Firewall Setup Script
# This script configures a secure firewall with IP whitelist for the payment service

set -e

echo "🔐 Setting up iptables firewall with IP whitelist..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

# Disable UFW if it's active (to avoid conflicts with iptables)
echo -e "${YELLOW}🔥 Checking UFW status...${NC}"
if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$($SUDO ufw status | grep -c "Status: active" || echo "0")
    if [ "$UFW_STATUS" -gt 0 ]; then
        echo -e "${YELLOW}🚫 UFW is active. Disabling UFW to prevent conflicts with iptables...${NC}"
        $SUDO ufw --force disable
        echo "  ✅ UFW disabled"
    else
        echo "  ℹ️  UFW is not active"
    fi
else
    echo "  ℹ️  UFW is not installed"
fi

# Install iptables-persistent if not already installed
echo -e "${YELLOW}📦 Installing iptables-persistent...${NC}"
$SUDO apt update
$SUDO apt install -y iptables-persistent

echo -e "${YELLOW}🧹 Clearing existing iptables rules...${NC}"
# Clear existing rules
$SUDO iptables -F
$SUDO iptables -X
$SUDO iptables -t nat -F
$SUDO iptables -t nat -X
$SUDO iptables -t mangle -F
$SUDO iptables -t mangle -X

echo -e "${YELLOW}🛡️ Setting default policies...${NC}"
# Set default policies
$SUDO iptables -P INPUT DROP
$SUDO iptables -P FORWARD DROP
$SUDO iptables -P OUTPUT ACCEPT

echo -e "${YELLOW}🔄 Allowing loopback traffic...${NC}"
# Allow loopback
$SUDO iptables -I INPUT -i lo -j ACCEPT

echo -e "${YELLOW}🔗 Allowing established connections...${NC}"
# Allow established connections
$SUDO iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

echo -e "${YELLOW}🔐 Setting up IP whitelist...${NC}"
# Define whitelisted IPs
declare -a WHITELISTED_IPS=(
    "15.235.163.226"
    "103.183.121.6"
    "212.32.99.122"
    "51.79.234.1"
)

# Allow SSH from whitelisted IPs only
echo -e "${GREEN}🔑 Configuring SSH access (port 2025)...${NC}"
for ip in "${WHITELISTED_IPS[@]}"; do
    echo "  ✅ Allowing SSH from $ip"
    $SUDO iptables -A INPUT -p tcp --dport 2025 -s $ip -j ACCEPT
done

# Allow HTTP from whitelisted IPs only
echo -e "${GREEN}🌐 Configuring HTTP access (port 80)...${NC}"
for ip in "${WHITELISTED_IPS[@]}"; do
    echo "  ✅ Allowing HTTP from $ip"
    $SUDO iptables -A INPUT -p tcp --dport 80 -s $ip -j ACCEPT
done

# Allow HTTPS from whitelisted IPs only
echo -e "${GREEN}🔒 Configuring HTTPS access (port 443)...${NC}"
for ip in "${WHITELISTED_IPS[@]}"; do
    echo "  ✅ Allowing HTTPS from $ip"
    $SUDO iptables -A INPUT -p tcp --dport 443 -s $ip -j ACCEPT
done

# Allow application port from whitelisted IPs only
echo -e "${GREEN}🚀 Configuring Application API access (port 3000)...${NC}"
for ip in "${WHITELISTED_IPS[@]}"; do
    echo "  ✅ Allowing API from $ip"
    $SUDO iptables -A INPUT -p tcp --dport 3000 -s $ip -j ACCEPT
done

echo -e "${RED}🛑 Blocking database ports explicitly...${NC}"
# Explicitly drop database ports (security)
$SUDO iptables -A INPUT -p tcp --dport 3306 -j DROP  # MySQL
$SUDO iptables -A INPUT -p tcp --dport 6379 -j DROP  # Redis
$SUDO iptables -A INPUT -p tcp --dport 5432 -j DROP  # PostgreSQL
echo "  ❌ MySQL (3306), Redis (6379), PostgreSQL (5432) blocked"

echo -e "${YELLOW}💾 Saving iptables rules...${NC}"
# Save iptables rules
$SUDO netfilter-persistent save
$SUDO netfilter-persistent reload

echo -e "${GREEN}✅ Firewall configuration completed!${NC}"
echo ""
echo -e "${YELLOW}📊 Current iptables rules:${NC}"
$SUDO iptables -L -n --line-numbers

echo ""
echo -e "${GREEN}🔐 Security Summary:${NC}"
echo "  ✅ UFW disabled (prevents conflicts with iptables)"
echo "  ✅ Default DENY policy active"
echo "  ✅ Demo configuration - all IPs allowed:"
for ip in "${WHITELISTED_IPS[@]}"; do
    echo "     - $ip"
done
echo "  ✅ Allowed ports: 2025 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (API)"
echo "  ❌ Database ports blocked: 3306, 6379, 5432"
echo "  💾 Rules persist across reboots"
echo ""
echo -e "${YELLOW}🔄 Restarting Docker service...${NC}"
$SUDO systemctl restart docker
echo "  ✅ Docker restarted"

echo -e "${YELLOW}🚀 Restarting payment service app...${NC}"
docker compose restart app
echo "  ✅ Payment service app restarted"

echo ""
echo -e "${GREEN}🎉 Your payment service is now secured with iptables and services restarted!${NC}"
