# QA Release Report - Smart ZZP Hub

## Build & Runtime
- Command: `DB_PASSWORD=testpass JWT_SECRET=testsecret docker compose up -d --build`
- Result: PASS (backend, nginx, postgres healthy)
- `docker compose ps`:
  - backend: healthy (0.0.0.0:4000)
  - postgres: healthy (no public port exposed)
  - nginx: healthy (80/443)

## Smoke Checks
- `curl http://localhost/` → 200 (UI rendered)
- `curl http://localhost/api/health` → 200 `{"status":"ok","service":"smart-zzp-hub-backend"}`

## E2E Execution (summary)
- Company admin login (company@example.com) success; dashboard visible.
- ZZP profiel (Test ZZP User) beschikbaar voor tenant.
- Werkbonnen aangemaakt voor alle tarieftypes (uur/stop/locatie/project/punt) → weekoverzicht gegenereerd → factuur `FACT-2025-0001` aangemaakt.
- Statement export (CSV/PDF) en “Verstuur per e-mail” schrijft naar `storage/mail-outbox` en is zichtbaar via `/api/outbox`.
- ZZP login (test@example.com) success; uitgave toegevoegd (brandstof) en statement zichtbaar.
- Statement status bijgewerkt naar `paid`.

## Security Audit (summary)
- CORS allowlist via `CORS_ORIGINS`.
- Env validation for `DATABASE_URL` and `JWT_SECRET` in production.
- Tenant isolation enforced in routes; Jest tests cover cross-tenant access.
- Rate limiting enabled; security headers through Nginx + Express.
- Outbox replaces SMTP for staging (file-based mail capture).

## Ready to Sell
READY TO SELL: YES — Core flows verified, containers healthy, tenant isolation enforced, documented deployment and quickstart, and staging-safe mail handling in place.
