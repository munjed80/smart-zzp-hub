# Security Audit - Smart ZZP Hub

## Scope
- Auth & roles (company_admin, company_staff, zzp_user)
- Tenant isolation by company_id / zzp_id
- Input validation, rate limiting, headers, CORS
- Secrets and startup validation

## Findings & Fixes
- **CORS allowlist**: Added `CORS_ORIGINS` env parsing with per-origin validation.
- **Env validation**: Backend now fails fast in production if `DATABASE_URL` or `JWT_SECRET` missing.
- **Tenant isolation**: Routes enforce `assertCompanyScope` / `assertZzpScope`; added Jest/Supertest tests in `tests/security/` to prevent cross-tenant leakage and auth bypass.
- **Outbox instead of SMTP**: Statement “email” writes to `storage/mail-outbox/` and is exposed via `/api/outbox` (authenticated company roles only).
- **Rate limiting & headers**: express-rate-limit enabled globally; Nginx adds security headers.
- **Input validation**: Parameterized queries already used; added VAT rate handling per tenant; export endpoints validate UUIDs.
- **Secrets**: All secrets from env; no hardcoded secrets in code or docs (demo creds documented separately).

## Tests
- `npm test` (auth/tenant + security isolation)
- Manual docker validation: `docker compose up -d --build`, `docker compose ps`, `curl /`, `curl /api/health`

## Residual Risks
- SMTP not wired; uses outbox file logging (acceptable for staging/demo). For production, plug SMTP provider where outbox is written today.
- Frontend is static SPA without build-step CSP; mitigated with Nginx headers and server-side validation.
