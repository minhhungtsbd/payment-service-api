# Payment Service

Hệ thống quản lý giao dịch ngân hàng tự động với hỗ trợ nhiều ngân hàng.

## ✨ Tính năng

- 🔄 **Tự động scraping giao dịch** từ nhiều ngân hàng (VCB, MB, TPBank, ACB)
- 💾 **Lưu trữ MySQL** với tự động cleanup (max 500 giao dịch hoặc 3 tháng)
- 📊 **RESTful API** để truy vấn và quản lý giao dịch
- 🤖 **Bot notifications** (Telegram, Discord) với queue system
- 🔗 **Webhook support** để tích hợp với hệ thống khác
- 🔐 **Proxy & Captcha solver** tích hợp sẵn
- 📈 **Queue dashboard** để monitor jobs
- ⚡ **Redis queue** cho reliability và retry logic
- 🔐 **Secure MySQL** với mật khẩu mạnh và network isolation
- 📊 **Disk space monitoring** với Telegram alerts

## 🚀 Cài đặt và Chạy

### Yêu cầu hệ thống
- **Docker** & **Docker Compose**
- **Git**
- **Nginx** (cho production)

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/minhhungtsbd/payment-service-api.git
cd payment-service-api

# 2. Cấu hình ngân hàng (Bắt buộc)
cp config/config.example.yml config/config.yml
# Chỉnh sửa config/config.yml với thông tin ngân hàng thật của bạn

# 3. Khởi động tất cả services
docker-compose up --build -d

# 4. Kiểm tra logs
docker-compose logs -f app

# 5. Test API (local)
curl http://localhost:3000/payments

# Or test production API
curl https://apibank.cloudmini.net/payments
```

### Dừng và dọn dẹp

```bash
# Dừng services
docker-compose down

# Xóa hoàn toàn (bao gồm volumes)
docker-compose down -v
docker system prune -af
```

### ⚙️ Cấu hình

#### Environment Variables (docker-compose.yml)

```yaml
environment:
  - PORT=3000
  - DB_HOST=mysql
  - DB_PORT=3306
  - DB_USER=root
  - DB_PASSWORD=secure_mysql_password_2025
  - DB_DATABASE=payment_service
  - CAPTCHA_API_BASE_URL=http://captcha-resolver:1234
  - REDIS_HOST=redis
  - REDIS_PORT=6379
```

#### Bank Configuration

**Bước 1: Tạo file cấu hình**
```bash
# Tạo file cấu hình từ mẫu
cp config/config.example.yml config/config.yml
```

**Bước 2: Chỉnh sửa config/config.yml**

```yaml
gateways:
  vcb_bank_1:
    type: 'VCBBANK'
    name: 'VCB Bank 1'
    password: 'your_password'
    account: 'your_account'
    login_id: 'your_login_id'
    device_id: 'your_device_id'
    repeat_interval_in_sec: 30
    proxy: []  # Optional proxy list

bots:
  telegram_bot:
    type: 'TELEGRAM'
    name: 'Main Bot'
    token: 'your_bot_token'
    chat_chanel_id: 'your_chat_id'
    admin_ids: ['admin_user_id']
    conditions:
      content_regex: '.*'
      account_regex: '.*'

webhooks:
  - name: 'external_system'
    url: 'https://your-webhook-url.com/webhook'
    token: 'webhook_secret_token'
    conditions:
      content_regex: '.*TRANSFER.*'
      account_regex: '.*'
```

## 📡 API Endpoints

### 💳 Payment Endpoints

#### Lấy danh sách giao dịch (từ database)
```bash
# Local development
GET http://localhost:3000/payments
GET http://localhost:3000/payments?limit=20&page=1

# Production
GET https://apibank.cloudmini.net/payments
GET https://apibank.cloudmini.net/payments?limit=20&page=1

# Response
{
  "transactions": [
    {
      "transaction_id": "vcbbank-5239-75811",
      "content": "MBVCB.1013072068...",
      "amount": 100000,
      "date": "2025-07-09T05:58:00Z",
      "gate": "VCBBANK",
      "account_receiver": "9909141311"
    }
  ]
}
```

#### Lấy giao dịch real-time (trực tiếp từ bank)
```bash
# Local development
GET http://localhost:3000/payments/real

# Production
GET https://apibank.cloudmini.net/payments/real

# Response: Array of real-time transactions
```

#### Thống kê database
```bash
# Local development
GET http://localhost:3000/payments/stats

# Production
GET https://apibank.cloudmini.net/payments/stats

# Response
{
  "totalTransactions": 245,
  "oldestTransaction": "2024-05-01T10:30:00Z",
  "limits": {
    "maxTransactions": 500,
    "maxAge": "90 days"
  }
}
```

#### Manual cleanup
```bash
# Local development
GET http://localhost:3000/payments/cleanup

# Production
GET https://apibank.cloudmini.net/payments/cleanup

# Response
{
  "success": true,
  "message": "Cleanup completed",
  "deletedByCount": 50,
  "deletedByAge": 15,
  "totalDeleted": 65
}
```

### 🏦 Gateway Management

#### Tạm dừng gateway
```bash
# Local development
GET http://localhost:3000/gateways/stop-gate?name=vcb_bank_1&time_in_sec=300

# Production
GET https://apibank.cloudmini.net/gateways/stop-gate?name=vcb_bank_1&time_in_sec=300

# Response
{
  "message": "ok",
  "next_run": "07-08-2025 12:35:00"
}
```

### 🤖 Bot Management

#### Webhook cho Telegram bot
```bash
# Local development
POST http://localhost:3000/bot/:token

# Production
POST https://apibank.cloudmini.net/bot/:token

Content-Type: application/json
X-Telegram-Bot-Api-Secret-Token: your_secret

# Body: Telegram update object
```

### 📊 Monitoring

#### Queue Dashboard
```bash
# Local development
GET http://localhost:3000/admin/queues
# Truy cập: http://localhost:3000/admin/queues

# Production
GET https://apibank.cloudmini.net/admin/queues
# Truy cập: https://apibank.cloudmini.net/admin/queues
```

#### Disk Space Monitoring

The system includes an automatic disk space monitor that will send alerts to your Telegram bot when disk space runs low.

```bash
# Manual check of disk space
node scripts/disk-monitor.js

# Setup the automatic monitor (runs every 5 minutes)
bash scripts/setup-disk-monitor.sh
```

Alerts are sent when:
- Warning: Disk usage exceeds 80%
- Critical: Disk usage exceeds 90%

Alerts include details about disk usage, Docker space usage, and recommended cleanup actions.

## 🔧 Docker Commands

### Development Commands

```bash
# Khởi động development mode
docker-compose up --build

# Chạy background
docker-compose up --build -d

# Xem logs real-time
docker-compose logs -f app

# Restart một service
docker-compose restart app

# Rebuild một service
docker-compose up --build app
```

### Database Commands

```bash
# Connect to MySQL
docker compose exec mysql mysql -u root -p payment_service
# Password: secure_mysql_password_2025

# Backup database
docker compose exec mysql mysqldump -u root -p payment_service > backup.sql
# Password: secure_mysql_password_2025

# Restore database
docker compose exec -i mysql mysql -u root -p payment_service < backup.sql
# Password: secure_mysql_password_2025

# Show tables
docker compose exec mysql mysql -u root -p -e "USE payment_service; SHOW TABLES;"
```

### Redis Commands

```bash
# Connect to Redis CLI
docker exec -it payment-service_redis_1 redis-cli

# Clear all Redis data
docker exec payment-service_redis_1 redis-cli FLUSHALL

# Monitor Redis commands
docker exec payment-service_redis_1 redis-cli MONITOR
```

### Cleanup Commands

```bash
# Stop và xóa containers
docker-compose down

# Xóa volumes (sẽ mất data!)
docker-compose down -v

# Xóa images
docker rmi payment-service_app

# Full cleanup
docker system prune -af
docker volume prune -f
```

## 📁 Cấu trúc Project

```
src/
├── payments/              # 💳 Payment management
│   ├── payment.entity.ts  # Database entity
│   ├── payments.controller.ts # API endpoints
│   └── payments.services.ts   # Business logic
├── gateways/              # 🏦 Bank integrations  
│   ├── gateway-factory/   # Bank-specific implementations
│   ├── gates.services.ts  # Base gateway service
│   └── gate.interface.ts  # Common interfaces
├── bots/                  # 🤖 Notification bots
│   ├── bot-factory/       # Bot implementations (Telegram, Discord)
│   ├── bot.service.ts     # Base bot service
│   └── bot.interfaces.ts  # Bot configurations
├── webhook/               # 🔗 Webhook handlers
│   ├── webhook.service.ts # Webhook processing
│   └── webhook.controller.ts # Webhook endpoints
├── captcha-solver/        # 🔐 Captcha solving
├── proxy/                 # 🌐 Proxy management
├── shards/                # 🛠️ Utilities
│   ├── events.ts          # Event constants
│   ├── helpers/           # Helper functions
│   └── middlewares/       # Custom middlewares
config/                    # ⚙️ Configuration files
docker-compose.yml         # 🐳 Docker services
Dockerfile                 # 📦 App container
```

## 🗄️ Database Schema

### MySQL Tables

```sql
-- Payments table
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  date TIMESTAMP NOT NULL,
  gate VARCHAR(50) NOT NULL, -- VCBBANK, MBBANK, etc.
  account_receiver VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_payments_date ON payments(date);
CREATE UNIQUE INDEX idx_payments_transaction_id ON payments(transaction_id);
```

### Redis Queues

```
Queues:
├── bot-TELEGRAM          # Telegram notifications
├── bot-DISCORD           # Discord notifications  
└── webhook               # External webhooks

Queue States:
├── WAITING              # Jobs waiting to process
├── ACTIVE               # Currently processing
├── COMPLETED            # Successfully completed
├── FAILED               # Failed jobs (with retry)
├── DELAYED              # Scheduled for later
└── PAUSED               # Queue is paused
```

## 📊 Monitoring & Troubleshooting

### Health Checks

```bash
# Check service status
docker-compose ps

# Check logs for errors
docker-compose logs -f app

# Check database connection (local)
curl http://localhost:3000/payments/stats

# Check database connection (production)
curl https://apibank.cloudmini.net/payments/stats

# Check queue dashboard (local)
open http://localhost:3000/admin/queues

# Check queue dashboard (production)
open https://apibank.cloudmini.net/admin/queues
```

### Common Issues

#### Redis connection errors
```bash
# Error: ECONNREFUSED 127.0.0.1:6379
# Solution: Ensure Redis service is running
docker-compose restart redis
```

#### Database connection errors
```bash
# Error: Connection to MySQL failed
# Solution: Check MySQL service
docker-compose restart mysql
docker-compose logs mysql
```

#### High memory usage
```bash
# Clear Redis queues
docker exec payment-service_redis_1 redis-cli FLUSHALL

# Manual cleanup old payments (local)
curl http://localhost:3000/payments/cleanup

# Manual cleanup old payments (production)
curl https://apibank.cloudmini.net/payments/cleanup
```

### Performance Tuning

#### Database Cleanup
- **Automatic**: Runs after each payment batch
- **Manual**: `GET /payments/cleanup`
- **Limits**: Max 500 transactions OR 3 months retention

#### Queue Management
- **Failed jobs**: Auto-retry with exponential backoff
- **Completion cleanup**: Keeps last 500 completed jobs
- **Monitoring**: Available at `/admin/queues`

### Production Deployment

#### Nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name apibank.cloudmini.net;
    
    # SSL certificates
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Payment API
    location /payments {
        allow your.allowed.ip.address;
        deny all;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Gateway management
    location /gateways {
        allow your.allowed.ip.address;
        deny all;
        proxy_pass http://localhost:3000;
    }
    
    # Admin dashboard
    location /admin {
        allow your.admin.ip.address;
        deny all;
        proxy_pass http://localhost:3000;
    }
}
```

#### Auto-restart Script
```bash
#!/bin/bash
# monitor.sh - Auto-restart on failures
while true; do
    if ! curl -s https://apibank.cloudmini.net/payments/stats > /dev/null; then
        echo "Service down, restarting..."
        docker-compose restart app
    fi
    sleep 30
done
```

## 🚀 Production Checklist

- [ ] **Configuration file** created: `cp config/config.example.yml config/config.yml`
- [ ] **Bank credentials** added to config/config.yml
- [ ] **Environment variables** configured
- [ ] **SSL certificates** installed
- [ ] **Nginx** properly configured with IP restrictions
- [ ] **Database backups** scheduled
- [ ] **Monitoring** alerts set up
- [ ] **Log rotation** configured
- [ ] **Resource limits** set in docker-compose.yml
- [ ] **Firewall rules** configured
- [ ] **Bot tokens** configured (if using notifications)

## 🖥️ Fresh VPS Deployment (Ubuntu 22.04)

Complete step-by-step guide for deploying on a new Ubuntu 22.04 VPS:

### 1. System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git ufw

# Set up firewall (allow SSH first!)
sudo ufw allow ssh
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

### 2. Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again, then verify
docker --version
docker-compose --version
```

### 3. Install Node.js (for disk monitoring)
```bash
# Install Node.js and npm
sudo apt install -y nodejs npm

# Verify installation
node --version  # Should show v18.x or higher
npm --version
```

### 4. Clone Repository and Configure
```bash
# Create project directory
sudo mkdir -p /var/www
cd /var/www

# Clone your repository
sudo git clone https://github.com/minhhungtsbd/payment-service-api.git
sudo chown -R $USER:$USER /var/www/payment-service-api
cd payment-service-api

# Configure bank credentials
cp config/config.example.yml config/config.yml
nano config/config.yml  # Edit with your bank credentials
```

### 5. Run Migration Script
```bash
# Run the MySQL migration and deployment script
bash scripts/migrate-to-mysql.sh
```

This script will:
- ✅ Stop any existing services
- 🗑️ Clean up PostgreSQL data (if migrating)
- 🔐 Set up secure MySQL with proper passwords
- 🚀 Start all services (app, MySQL, Redis, captcha-resolver)
- ✅ Verify database connection and security
- 📊 Show service status

### 6. Verify Deployment
```bash
# Check service status
docker compose ps

# Test API endpoint
curl http://localhost:3000/payments/stats

# Check application logs
docker compose logs -f app
```

### 7. Set up Disk Monitoring
```bash
# Set up automatic disk space monitoring with Telegram alerts
bash scripts/setup-disk-monitor.sh

# Test disk monitor manually
node scripts/disk-monitor.js
```

### 8. Configure Firewall for Production
```bash
# Allow your application port
sudo ufw allow 3000/tcp

# If using Nginx (recommended for production)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check firewall status
sudo ufw status
```

### 9. Optional: Set up Nginx (Production)
```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/payment-service

# Example configuration:
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/payment-service /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 10. Set up SSL (Optional but Recommended)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 11. Schedule Daily Backups
```bash
# Create backup script
sudo nano /usr/local/bin/backup-payment-db.sh

# Add this content:
#!/bin/bash
BACKUP_DIR="/var/backups/payment-service"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cd /var/www/payment-service
docker compose exec mysql mysqldump -u root -psecure_mysql_password_2025 payment_service > "$BACKUP_DIR/payment_service_$DATE.sql"
# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete

# Make executable
sudo chmod +x /usr/local/bin/backup-payment-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-payment-db.sh
```

### 12. Verify Everything is Working
```bash
# Check all services
docker compose ps

# Test API
curl http://localhost:3000/payments/stats

# Check disk monitor
node scripts/disk-monitor.js

# Check logs
docker compose logs --tail=50 app

# Check cron jobs
crontab -l
```

### 🔐 Security Notes
- ✅ MySQL is secured with strong password: `secure_mysql_password_2025`
- ✅ Databases are not exposed to the internet (internal Docker network only)
- ✅ Firewall is configured to allow only necessary ports
- ✅ Disk monitoring sends alerts before problems occur
- ✅ Automatic database backups are scheduled

### 🚨 Troubleshooting

#### If services fail to start:
```bash
# Check logs
docker compose logs app
docker compose logs mysql

# Restart services
docker compose restart
```

#### If disk space is full:
```bash
# Clean up Docker
docker system prune -f

# Check disk usage
df -h

# Manual cleanup
curl http://localhost:3000/payments/cleanup
```

#### If Node.js is missing:
```bash
# Install Node.js
sudo apt install -y nodejs npm
node --version
```

Your payment service is now fully deployed and secure! 🎉

## 📋 API Testing Examples

```bash
# === LOCAL DEVELOPMENT ===
# Test basic API
curl http://localhost:3000/payments

# Test with pagination
curl "http://localhost:3000/payments?limit=10&page=1"

# Get real-time data
curl http://localhost:3000/payments/real

# Check statistics
curl http://localhost:3000/payments/stats

# Manual cleanup
curl http://localhost:3000/payments/cleanup

# Stop gateway temporarily
curl "http://localhost:3000/gateways/stop-gate?name=vcb_bank_1&time_in_sec=300"

# === PRODUCTION ===
# Test basic API
curl https://apibank.cloudmini.net/payments

# Test with pagination
curl "https://apibank.cloudmini.net/payments?limit=10&page=1"

# Get real-time data
curl https://apibank.cloudmini.net/payments/real

# Check statistics
curl https://apibank.cloudmini.net/payments/stats

# Manual cleanup
curl https://apibank.cloudmini.net/payments/cleanup

# Stop gateway temporarily
curl "https://apibank.cloudmini.net/gateways/stop-gate?name=vcb_bank_1&time_in_sec=300"
```

## 🤝 Support

For technical support or configuration help:
1. Check the logs: `docker-compose logs -f app`
2. Review configuration files
3. Test API endpoints manually
4. Check queue dashboard for failed jobs

## 📄 License

Private - All rights reserved
