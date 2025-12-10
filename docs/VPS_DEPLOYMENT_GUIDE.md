# Smart ZZP Hub - VPS Deployment Guide

This guide provides step-by-step instructions for deploying Smart ZZP Hub on a Virtual Private Server (VPS).

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04 LTS or later (or similar Linux distribution)
- **CPU**: 2+ cores
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum
- **Node.js**: v18 or later
- **PostgreSQL**: v12 or later

### Required Software
- Git
- Node.js and npm
- PostgreSQL
- nginx (recommended for reverse proxy)
- PM2 or systemd (for process management)
- Optional: Docker and Docker Compose

## Deployment Options

Choose one of the following deployment methods:

1. **Docker Compose** (Easiest, recommended for quick setup)
2. **PM2** (Recommended for production)
3. **systemd** (Traditional Linux service)
4. **Manual** (Direct Node.js)

---

## Option 1: Docker Compose Deployment

### Step 1: Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2: Clone Repository

```bash
cd /var/www
sudo git clone https://github.com/munjed80/smart-zzp-hub.git
cd smart-zzp-hub
```

### Step 3: Configure Environment

```bash
# Create .env file in root directory
cat > .env << EOF
DB_USER=zzp_user
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)
EOF

# View generated passwords (save these securely!)
cat .env
```

### Step 4: Deploy

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 5: Verify

```bash
# Test backend
curl http://localhost:4000/api/health

# Test frontend (if nginx is configured)
curl http://localhost/health
```

**That's it!** Your application is now running.

---

## Option 2: PM2 Deployment (Recommended)

### Step 1: Install Node.js and PostgreSQL

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
```

### Step 2: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE smart_zzp_hub;
CREATE USER zzp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE smart_zzp_hub TO zzp_user;
\q
```

### Step 3: Clone and Setup Application

```bash
# Clone repository
cd /var/www
sudo git clone https://github.com/munjed80/smart-zzp-hub.git
cd smart-zzp-hub

# Install backend dependencies
cd backend
npm ci --only=production
cd ..
```

### Step 4: Configure Environment

```bash
# Create .env file
cat > backend/.env << EOF
DATABASE_URL=postgresql://zzp_user:your_secure_password@localhost:5432/smart_zzp_hub
PORT=4000
NODE_ENV=production
JWT_SECRET=$(openssl rand -base64 32)
EOF
```

### Step 5: Initialize Database

```bash
# Run schema
psql postgresql://zzp_user:your_secure_password@localhost:5432/smart_zzp_hub -f db/schema.sql
```

### Step 6: Install and Configure PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Follow the command output to complete setup
```

### Step 7: Verify

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs smart-zzp-hub

# Test endpoint
curl http://localhost:4000/api/health
```

---

## Option 3: systemd Service Deployment

### Step 1-5: Follow PM2 steps 1-5

### Step 6: Install systemd Service

```bash
# Copy service file
sudo cp smart-zzp-hub.service /etc/systemd/system/

# Edit paths if needed
sudo nano /etc/systemd/system/smart-zzp-hub.service

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable smart-zzp-hub

# Start service
sudo systemctl start smart-zzp-hub

# Check status
sudo systemctl status smart-zzp-hub
```

### Step 7: Verify

```bash
# View logs
sudo journalctl -u smart-zzp-hub -f

# Test endpoint
curl http://localhost:4000/api/health
```

---

## nginx Reverse Proxy Setup

### Step 1: Install nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### Step 2: Configure nginx

```bash
# Copy provided configuration
sudo cp nginx.conf /etc/nginx/nginx.conf

# Or create site-specific configuration
sudo nano /etc/nginx/sites-available/smart-zzp-hub

# Enable site
sudo ln -s /etc/nginx/sites-available/smart-zzp-hub /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 3: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Allow SSH (important!)
sudo ufw allow OpenSSH

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## SSL Certificate Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Post-Deployment Tasks

### 1. Security Hardening

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Configure automatic security updates
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Disable root SSH login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 2. Monitoring Setup

```bash
# Install monitoring tools
sudo npm install -g pm2-logrotate
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 3. Backup Configuration

```bash
# Create backup script
sudo nano /usr/local/bin/backup-zzp-hub.sh
```

Add to script:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/smart-zzp-hub"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump postgresql://zzp_user:password@localhost/smart_zzp_hub > "$BACKUP_DIR/db_$DATE.sql"

# Backup .env file
cp /var/www/smart-zzp-hub/backend/.env "$BACKUP_DIR/env_$DATE.backup"

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.backup" -mtime +7 -delete
```

Make executable and schedule:
```bash
sudo chmod +x /usr/local/bin/backup-zzp-hub.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-zzp-hub.sh
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
pm2 logs smart-zzp-hub
# or
sudo journalctl -u smart-zzp-hub -n 50

# Common issues:
# 1. DATABASE_URL not set or incorrect
# 2. PostgreSQL not running
# 3. Port 4000 already in use
# 4. JWT_SECRET not set
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql postgresql://zzp_user:password@localhost:5432/smart_zzp_hub -c "SELECT 1"

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Port Already in Use

```bash
# Find process using port 4000
sudo lsof -i :4000

# Kill process if needed
sudo kill -9 <PID>
```

---

## Updating the Application

### Using PM2

```bash
cd /var/www/smart-zzp-hub

# Pull latest changes
git pull origin main

# Install new dependencies
cd backend
npm ci --only=production
cd ..

# Restart application
pm2 restart smart-zzp-hub

# Or use zero-downtime reload
pm2 reload smart-zzp-hub
```

### Using systemd

```bash
cd /var/www/smart-zzp-hub
git pull origin main
cd backend
npm ci --only=production
cd ..
sudo systemctl restart smart-zzp-hub
```

### Using Docker Compose

```bash
cd /var/www/smart-zzp-hub
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

---

## Performance Tuning

### Enable PM2 Cluster Mode

```bash
# Edit ecosystem.config.js
# Change:
#   instances: 1 → instances: 'max'
#   exec_mode: 'fork' → exec_mode: 'cluster'

# Restart
pm2 restart smart-zzp-hub
```

### PostgreSQL Optimization

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/*/main/postgresql.conf

# Recommended settings for 4GB RAM:
# shared_buffers = 1GB
# effective_cache_size = 3GB
# work_mem = 16MB
# maintenance_work_mem = 256MB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## Monitoring and Maintenance

### Health Checks

```bash
# Backend health
curl http://localhost:4000/api/health

# Full application health
curl http://your-domain.com/api/health
```

### Log Monitoring

```bash
# PM2 logs
pm2 logs smart-zzp-hub --lines 100

# systemd logs
sudo journalctl -u smart-zzp-hub -f

# nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Performance Monitoring

```bash
# PM2 monitoring dashboard
pm2 monit

# System resources
htop
```

---

## Support and Resources

- **Documentation**: See `/docs` directory
- **Issues**: https://github.com/munjed80/smart-zzp-hub/issues
- **Backend Health**: `http://your-domain.com/api/health`

---

**Next Steps After Deployment:**
1. ✅ Configure domain DNS to point to your VPS IP
2. ✅ Set up SSL certificates with Let's Encrypt
3. ✅ Configure automated backups
4. ✅ Set up monitoring and alerting
5. ✅ Review security best practices
6. ✅ Test all application features
7. ✅ Document your specific configuration
