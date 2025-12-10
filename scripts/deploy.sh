#!/bin/bash

# Smart ZZP Hub - Deployment Script
# Quick deployment script for VPS

set -e

echo "=========================================="
echo "Smart ZZP Hub - Deployment Script"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "ERROR: backend/.env file not found"
    echo "Please create it from .env.production or backend/.env.example"
    exit 1
fi

echo "Step 1: Installing backend dependencies..."
cd backend
npm ci --only=production
cd ..

echo ""
echo "Step 2: Checking environment variables..."
source backend/.env

if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set in .env"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "ERROR: JWT_SECRET not set in .env"
    exit 1
fi

echo "✓ Environment variables configured"

echo ""
echo "Step 3: Testing database connection..."
node -e "
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()')
  .then(() => { console.log('✓ Database connection successful'); pool.end(); process.exit(0); })
  .catch(err => { console.error('✗ Database connection failed:', err.message); pool.end(); process.exit(1); });
"

echo ""
echo "Step 4: Starting application..."
echo "Choose deployment method:"
echo "  1) PM2 (recommended)"
echo "  2) systemd"
echo "  3) Docker Compose"
echo "  4) Direct node (development only)"
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo "Starting with PM2..."
        if ! command -v pm2 &> /dev/null; then
            echo "Installing PM2..."
            npm install -g pm2
        fi
        pm2 start ecosystem.config.js --env production
        pm2 save
        pm2 list
        echo ""
        echo "✓ Application started with PM2"
        echo "  View logs: pm2 logs smart-zzp-hub"
        echo "  Stop app: pm2 stop smart-zzp-hub"
        ;;
    2)
        echo "Setting up systemd service..."
        sudo cp smart-zzp-hub.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable smart-zzp-hub
        sudo systemctl start smart-zzp-hub
        sudo systemctl status smart-zzp-hub
        echo ""
        echo "✓ Application started with systemd"
        echo "  View logs: sudo journalctl -u smart-zzp-hub -f"
        echo "  Stop app: sudo systemctl stop smart-zzp-hub"
        ;;
    3)
        echo "Starting with Docker Compose..."
        if ! command -v docker-compose &> /dev/null; then
            echo "ERROR: docker-compose not found"
            exit 1
        fi
        docker-compose up -d
        docker-compose ps
        echo ""
        echo "✓ Application started with Docker Compose"
        echo "  View logs: docker-compose logs -f"
        echo "  Stop app: docker-compose down"
        ;;
    4)
        echo "Starting with Node.js directly..."
        cd backend
        NODE_ENV=production node src/index.js
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Deployment completed!"
echo "=========================================="
echo ""
echo "Application should be running on:"
echo "  Backend: http://localhost:${PORT:-4000}/api/health"
echo ""
echo "Next steps:"
echo "  1. Configure nginx reverse proxy (see nginx.conf)"
echo "  2. Set up SSL certificates (Let's Encrypt recommended)"
echo "  3. Configure firewall rules"
echo "  4. Set up log rotation"
echo "  5. Configure automated backups"
