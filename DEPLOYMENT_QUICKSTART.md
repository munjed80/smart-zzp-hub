# 🚀 Smart ZZP Hub - Quick Deployment Guide

## Quick Start (3 Minutes)

### Option 1: Docker Compose (Recommended for Quick Setup)

```bash
# 1. Clone repository
git clone https://github.com/munjed80/smart-zzp-hub.git
cd smart-zzp-hub

# 2. Create environment variables
cat > .env << EOF
DB_USER=zzp_user
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)
EOF

# 3. Start everything
docker-compose up -d

# 4. Verify
curl http://localhost:4000/api/health
```

**Done!** Your app is running at:
- Backend: `http://localhost:4000`
- Frontend: `http://localhost` (via nginx)

---

### Option 2: PM2 (Recommended for Production)

```bash
# 1. Install prerequisites
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# 2. Setup PostgreSQL
sudo -u postgres psql << EOF
CREATE DATABASE smart_zzp_hub;
CREATE USER zzp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE smart_zzp_hub TO zzp_user;
EOF

# 3. Clone and install
git clone https://github.com/munjed80/smart-zzp-hub.git
cd smart-zzp-hub/backend
npm ci --only=production

# 4. Configure environment
cat > .env << EOF
DATABASE_URL=postgresql://zzp_user:your_secure_password@localhost:5432/smart_zzp_hub
PORT=4000
NODE_ENV=production
JWT_SECRET=$(openssl rand -base64 32)
EOF

# 5. Initialize database
cd ..
psql $DATABASE_URL -f db/schema.sql

# 6. Install PM2 and start
sudo npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# 7. Setup nginx (optional)
sudo apt-get install -y nginx
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```

**Done!** Check status with `pm2 status`

---

## Environment Variables

Create `backend/.env` with:

```bash
# Required
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-secret-key-here

# Optional
PORT=4000
NODE_ENV=production
```

Generate secure secrets:
```bash
openssl rand -base64 32
```

---

## Post-Deployment Checklist

- [ ] Verify backend health: `curl http://localhost:4000/api/health`
- [ ] Configure firewall: `sudo ufw allow 80,443/tcp`
- [ ] Setup SSL with Let's Encrypt: `sudo certbot --nginx -d your-domain.com`
- [ ] Configure automated backups (see VPS_DEPLOYMENT_GUIDE.md)
- [ ] Setup monitoring/logging
- [ ] Test all API endpoints
- [ ] Review security settings

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
pm2 logs smart-zzp-hub
# or
sudo journalctl -u smart-zzp-hub -f
```

### Database connection failed
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL status
sudo systemctl status postgresql
```

### Port already in use
```bash
# Find process
sudo lsof -i :4000

# Stop it
sudo kill -9 <PID>
```

---

## Resources

- **Full Guide**: [docs/VPS_DEPLOYMENT_GUIDE.md](docs/VPS_DEPLOYMENT_GUIDE.md)
- **API Routes**: [docs/ROUTES.md](docs/ROUTES.md)
- **Architecture**: [docs/OVERVIEW.md](docs/OVERVIEW.md)
- **UI Previews**: [docs/PREVIEW.md](docs/PREVIEW.md)

---

## Support

- **Issues**: https://github.com/munjed80/smart-zzp-hub/issues
- **Health Check**: `http://your-domain.com/api/health`

---

**Status**: ✅ Production Ready

All deployment configurations tested and verified.
