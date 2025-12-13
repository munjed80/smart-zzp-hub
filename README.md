# Smart ZZP Hub

Smart ZZP Hub is a dual-portal SaaS voor Nederlandse ZZP’ers en bedrijven. Bedrijven registreren werk, genereren weekoverzichten en facturen; ZZP’ers zien hun overzichten, maken facturen en houden uitgaven bij. De UI is volledig in het Nederlands, terwijl code en identifiers in het Engels blijven.

## Wat zit erin
- Responsieve dashboard UI (served op `/`) met rollen: `company_admin`, `company_staff`, `zzp_user`
- JWT-authenticatie en strikte tenant isolatie op `company_id`
- Werkbonnen, weekoverzichten, export (PDF/CSV) en factuurgeneratie
- Uitgavenregistratie (ZZP) + BTW-overzichten
- Postgres schema + seeds, automatische init via Docker Compose
- Nginx reverse proxy en rate limiting, veilige headers

## Snel starten (Docker Compose)
```bash
git clone https://github.com/munjed80/smart-zzp-hub.git
cd smart-zzp-hub
cp .env.example .env             # vul DB_PASSWORD en JWT_SECRET in
docker-compose up -d
```
Ga naar `http://localhost` voor de UI. Inloggen kan direct met de seed-accounts:
- bedrijf: `company@example.com` / `test123` (rol: company_admin)
- zzp: `test@example.com` / `test123` (rol: zzp_user)

## Handmatige installatie (zonder Docker)
```bash
cd backend
npm ci
DATABASE_URL=postgresql://... npm run dev
```
Zorg dat de Postgres database is gevuld met `db/schema.sql` en `db/seed.sql`.

## Architectuur
- **Backend:** Node.js + Express, JWT, rate limiting, security headers
- **Frontend:** Lichtgewicht SPA (vanilla JS) served via Express/Nginx
- **Database:** PostgreSQL met UUID’s, tenant scoping via `company_id`
- **Exports:** Statements naar PDF/CSV; facturen als PDF (base64 via API)
- **E-mail (staging):** Outbox logging in `storage/mail-outbox` i.p.v. directe SMTP

## Belangrijke mappen
- `backend/src` – API routes, middleware, PDF/CSV exports
- `frontend/public` – Productieklare statische UI (geladen op `/`)
- `db/` – Schema, migraties, seeds
- `docker-compose.yml` – Backend, Postgres, Nginx reverse proxy

## Eerste klant onboarden
1) Deploy (Docker Compose of VPS).  
2) Maak een admin-account of gebruik de seed `company@example.com`.  
3) Voeg ZZP-profielen toe en registreer werkbonnen.  
4) Genereer een weekoverzicht en exporteer PDF/CSV.  
5) Klik “Factuur” bij het overzicht om de juridische factuur te genereren.  
6) ZZP’er logt in, ziet overzichten/facturen en registreert uitgaven.

## Omgevingsvariabelen
Zie `.env.example` voor alle variabelen. Kernwaarden:
- `DATABASE_URL` (postgres://user:pass@host:5432/db)
- `JWT_SECRET` (sterke secret)
- `PORT` (default 4000)

## Beveiliging
- Geen externe DB-poort in Docker Compose
- Rate limiting op alle endpoints
- Security headers via Express + Nginx
- JWT expiratie standaard 7 dagen

## Licentie
MIT

### 2. PM2 (Production Recommended)
```bash
# Install dependencies, configure .env, initialize database
pm2 start ecosystem.config.js --env production
```

See [DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md) for complete instructions.
