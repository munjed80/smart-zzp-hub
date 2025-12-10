# Smart ZZP Hub

Smart ZZP Hub is a dual-portal platform for Dutch ZZP freelancers and the mid-sized companies that work with them.

The goal of this project is to automate the weekly workflow:

- Companies register delivered work (stops, hours, locations, points, projects).
- The system generates weekly statements per ZZP.
- ZZP users log in, review their statement, and create an official invoice in one click.

The **default UI language will be Dutch**, but all code, identifiers, and comments are in English to keep the codebase clean.

## Project structure

- `backend/` – Node.js + Express REST API
- `db/` – Database schema drafts (PostgreSQL‑oriented)
- `docs/` – Functional and flow documentation (EN)

## MVP scope

**Company portal**

- Manage ZZP profiles (basic contact and contract data).
- Log work entries per ZZP:
  - tariff type: stop / hour / location / point / project
  - quantity
  - agreed unit price
  - work date
- Generate weekly statements per ZZP.
- Export statements as PDF or CSV and send them to ZZP by email.

**ZZP portal**

- View weekly statements.
- Generate an invoice from a statement (PDF).
- Basic expense tracking (fuel, maintenance, materials).
- Overview of paid / unpaid invoices.

## Technical stack (initial)

- Backend: Node.js + Express
- Database: PostgreSQL (or a compatible cloud service)
- Auth: to be decided (JWT / session‑based)
- Frontend: will be added later (likely Next.js or a lightweight SPA)
- Language:
  - UI texts: Dutch (via translation files)
  - Code: English

## Status

✅ **Production Ready!** This repository contains a complete, fully-functional application ready for VPS deployment.

### Quick Links
- 🚀 **[Quick Deployment Guide](DEPLOYMENT_QUICKSTART.md)** - Deploy in 3 minutes
- 📚 **[Complete VPS Guide](docs/VPS_DEPLOYMENT_GUIDE.md)** - Detailed instructions
- 🔍 **[API Documentation](docs/ROUTES.md)** - All endpoints
- 🖼️ **[UI Previews](docs/PREVIEW.md)** - Screenshots of all pages
- 📋 **[Deployment Status](docs/DEPLOYMENT.md)** - Readiness checklist

### What's Included
- ✅ Backend API (10 routes, fully tested)
- ✅ Frontend UI (9 pages, Dutch language)
- ✅ Database schema and migrations
- ✅ Docker Compose configuration
- ✅ PM2 and systemd configurations
- ✅ Nginx reverse proxy setup
- ✅ SSL/TLS support
- ✅ Security best practices
- ✅ Automated deployment scripts

## Deployment

Choose your preferred deployment method:

### 1. Docker Compose (Fastest)
```bash
git clone https://github.com/munjed80/smart-zzp-hub.git
cd smart-zzp-hub
# Create .env with DB_USER, DB_PASSWORD, JWT_SECRET
docker-compose up -d
```

### 2. PM2 (Production Recommended)
```bash
# Install dependencies, configure .env, initialize database
pm2 start ecosystem.config.js --env production
```

See [DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md) for complete instructions.
