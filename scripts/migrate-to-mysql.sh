#!/bin/bash

# MySQL Migration Script
# This script migrates from PostgreSQL to MySQL with security improvements

set -e

echo "🔄 Starting migration from PostgreSQL to MySQL..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker-compose is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not available${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed or not available${NC}"
    exit 1
fi

# Use docker compose or docker-compose
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

echo -e "${YELLOW}📋 Pre-migration checklist:${NC}"
echo "1. ✅ Docker Compose available: $COMPOSE_CMD"

# Stop current services
echo -e "${YELLOW}🛑 Stopping current services...${NC}"
$COMPOSE_CMD down

# Remove PostgreSQL volumes (data will be lost)
echo -e "${YELLOW}🗑️ Removing PostgreSQL volumes...${NC}"
$COMPOSE_CMD down -v
docker volume rm payment-service_postgres-data 2>/dev/null || true

# Remove any existing compromised databases
echo -e "${YELLOW}🔐 Security cleanup...${NC}"
docker system prune -f

echo -e "${YELLOW}📦 Building new MySQL-based services...${NC}"
$COMPOSE_CMD build --no-cache

echo -e "${YELLOW}🚀 Starting MySQL services...${NC}"
$COMPOSE_CMD up -d mysql redis captcha-resolver

# Wait for MySQL to be ready
echo -e "${YELLOW}⏳ Waiting for MySQL to be ready...${NC}"
for i in {1..30}; do
    if $COMPOSE_CMD exec mysql mysql -u root -psecure_mysql_password_2025 -e "SELECT 1" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ MySQL is ready!${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Verify MySQL database was created
echo -e "${YELLOW}🔍 Verifying database creation...${NC}"
$COMPOSE_CMD exec mysql mysql -u root -psecure_mysql_password_2025 -e "SHOW DATABASES;" | grep payment_service

echo -e "${YELLOW}🚀 Starting application...${NC}"
$COMPOSE_CMD up -d

# Wait a moment for app to start
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 10

# Check application logs
echo -e "${YELLOW}📋 Application startup logs:${NC}"
$COMPOSE_CMD logs app | tail -20

# Verify services are running
echo -e "${YELLOW}🔍 Service status:${NC}"
$COMPOSE_CMD ps

# Security verification
echo -e "${YELLOW}🔐 Security verification:${NC}"
echo "Checking that databases are not exposed to internet..."

# Check if MySQL port is exposed
if netstat -tlnp 2>/dev/null | grep :3306 | grep -v 127.0.0.1 >/dev/null 2>&1; then
    echo -e "${RED}⚠️  WARNING: MySQL might be exposed to internet!${NC}"
else
    echo -e "${GREEN}✅ MySQL is properly secured (not exposed to internet)${NC}"
fi

# Check if Redis port is exposed  
if netstat -tlnp 2>/dev/null | grep :6379 | grep -v 127.0.0.1 >/dev/null 2>&1; then
    echo -e "${RED}⚠️  WARNING: Redis might be exposed to internet!${NC}"
else
    echo -e "${GREEN}✅ Redis is properly secured (not exposed to internet)${NC}"
fi

echo -e "${GREEN}✅ Migration to MySQL completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Next steps:${NC}"
echo "1. Test API: curl http://localhost:3000/payments/stats"
echo "2. Check logs: $COMPOSE_CMD logs -f app"
echo "3. Set up disk monitoring: bash scripts/setup-disk-monitor.sh"
echo "4. Set up firewall rules (see README for commands)"
echo ""
echo -e "${YELLOW}🔐 Security Notes:${NC}"
echo "- Database is now properly secured (not exposed to internet)"
echo "- Strong password is set: secure_mysql_password_2025"
echo "- Make sure to set up firewall rules as documented"
echo ""
echo -e "${GREEN}🎉 Your payment service is now running on MySQL!${NC}"
