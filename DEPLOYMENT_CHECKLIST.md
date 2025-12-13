# Deployment Checklist - Smart ZZP Hub

## Prerequisites
- Docker + Docker Compose installed
- Domain + DNS pointing to server (optional for HTTPS)
- Server ports 80/443 open
- `.env` file based on `.env.example` with strong `DB_PASSWORD` and `JWT_SECRET`

## Install Steps
1. Clone repo: `git clone https://github.com/munjed80/smart-zzp-hub.git && cd smart-zzp-hub`
2. Create `.env` from `.env.example` and fill secrets (incl. `CORS_ORIGINS`).
3. Pull/build and start: `docker compose up -d --build`
4. Verify health:
   - `docker compose ps`
   - `curl http://localhost/api/health`
   - `curl http://localhost/`

## First-Run Initialization
- Database auto-initializes from `db/schema.sql` + `db/seed.sql`.
- Seed demo accounts:
  - Company admin: `company@example.com` / `test123`
  - ZZP user: `test@example.com` / `test123`
- Update passwords after login via API if required.

## Backups
- Postgres data stored in `postgres_data` volume.
- Backup: `docker compose exec postgres pg_dump -U $DB_USER $DB_NAME > backup.sql`
- Restore: `cat backup.sql | docker compose exec -T postgres psql -U $DB_USER $DB_NAME`

## Update Process
1. `git pull`
2. `docker compose pull` (if using registry images) or rebuild: `docker compose build`
3. `docker compose up -d`
4. Validate health endpoints and UI.

## Rollback
1. `git checkout <previous-tag-or-commit>`
2. `docker compose pull` (if tagged images) or rebuild that version.
3. `docker compose down`
4. `docker compose up -d`

## Monitoring & Logs
- `docker compose logs --tail=200 backend`
- `docker compose logs --tail=200 postgres`
- `docker compose logs --tail=200 nginx`

## Security Notes
- DB port not exposed externally.
- Rate limiting and security headers enabled.
- Use HTTPS by mounting certs into `ssl/` and enabling nginx TLS block.
