# Phase 4 Security Audit

**Scope:** Django API, React SPA, container and Nginx configuration, deployment scripts. **Method:** configuration review against the Django deployment checklist (`manage.py check --deploy`), code review of authentication, authorisation and file handling, and tests for each fix. **Date:** November 2026.

This is a pre-go-live review by the Development Team. It does **not** replace the annual penetration test owned by the Institute Security Authority (proposal §11).

## Findings and remediation

| ID | Finding | Risk | Status | Remediation |
|---|---|---|---|---|
| SEC-01 | Production could start with the published development `SECRET_KEY`, so anyone could forge login tokens | Critical | **Fixed** | The backend refuses to start with `DEBUG=False` unless the key is ≥ 50 characters and not the development key. Tested in `TestProductionSecurityGate`. |
| SEC-02 | `ALLOWED_HOSTS = ['*']` in every environment (host-header attacks) | High | **Fixed** | Read from `DJANGO_ALLOWED_HOSTS`. `*` is only possible with DEBUG on. |
| SEC-03 | CORS allowed every origin with credentials | High | **Fixed** | Explicit `CORS_ALLOWED_ORIGINS` allow-list. Allow-all only in DEBUG. |
| SEC-04 | No HTTPS redirect, HSTS, secure cookies, or browser hardening headers | Medium | **Fixed** | SSL redirect, HSTS, Secure/HttpOnly cookies, `X-Frame-Options: DENY`, `nosniff` and `Referrer-Policy` in Django; matching headers in Nginx. HSTS is not extended to subdomains or preload by default, because ARP cannot vouch for every `*.iitmandi.ac.in` host (Django checks W005 and W021 are silenced for this reason; set `DJANGO_HSTS_INCLUDE_SUBDOMAINS=True` to opt in). |
| SEC-05 | Unlimited login attempts (password brute force) | Medium | **Fixed** | `ScopedRateThrottle` on `/api/auth/token/`, 10 per minute per IP (configurable). Tested in `TestLoginThrottle`. |
| SEC-06 | Backend container ran Django's development server (`runserver`) | High | **Fixed** | gunicorn with 4 workers. Migrations and seeding run in `entrypoint.sh`. |
| SEC-07 | Backend container ran as root | Medium | **Fixed** | Runs as unprivileged user `dora` (uid 1000). |
| SEC-08 | Database password and a secret key committed in `docker-compose.yml`; PostgreSQL published on host port 5432 | High | **Fixed** | Secrets moved to a git-ignored `.env.production` (template committed). Compose fails fast if the password is missing. The database is no longer published on the host. |
| SEC-09 | Nginx proxied `/media/` (proof files) without authentication | Medium | **Fixed** | `/media/` returns 404. Proofs are served only through the authenticated, checksum-verified download endpoint. |
| SEC-10 | No liveness endpoint, so failures went unnoticed | Low | **Fixed** | `/api/health/` (database check, no sensitive data) and a Docker `HEALTHCHECK`. |
| SEC-11 | No tested backup or restore | High | **Fixed** | Verified archives with SHA-256 manifests, safe extraction (path traversal refused), restore that verifies first, and an automated DR drill. Tested in `TestBackups`, `TestDrill` and `test_restore_round_trip`. |
| SEC-12 | JWT access tokens live for 24 h, and refresh tokens are not blacklisted on rotation | Low | Accepted (documented) | Acceptable for an internal staff tool. If required, shorten `ACCESS_TOKEN_LIFETIME` and enable the SimpleJWT blacklist app. |
| SEC-13 | No MFA or SSO for privileged accounts (proposal Appendix B) | Medium | **Open: needs IT Services** | Depends on the Institute identity provider. Until it is available, Admin and Director passwords must follow Institute policy, and access must be limited to the campus network at the reverse proxy. |
| SEC-14 | No automated dependency or SAST scanning in CI | Low | **Open: recommended** | Enable GitHub Dependabot and CodeQL on the Institute repository. |

## Controls verified as already in place

- **Role-based access (Phase 3)**: deny by default (`IsAuthenticated` is the global default, and public endpoints opt in with `AllowAny`). Admin is the only role that writes, apart from go-live sign-offs, which the Director also records. Director and Auditor are read-only. Nodal officers are confined to their own unit and to token-scoped upload links. Guarded SPA routes mirror the API rules.
- **AI review (Phase 3)**: optional; sends only aggregated, PII-free figures; rejects ungrounded replies; logs every call.
- **Upload links**: only SHA-256 digests are stored, links rotate on reminder, and they expire and can be revoked.
- **Audit trail**: append-only (`save` on an existing row and `delete` both raise). Personal fields are redacted from deltas.
- **Proof files**: type and size limits (25 MB), SHA-256 on upload, re-verified on download.
- **SQL injection**: all data access goes through the Django ORM, with no raw SQL on request input.
- **XSS**: React escapes rendered output. The API returns JSON only.
- **Sign-offs**: immutable at the model level. Change and delete are disabled in the Django admin.

## Residual actions before go-live

1. IT Services: TLS certificate and HTTPS at the reverse proxy; restrict `/admin/` to campus IPs.
2. IT Services and Security Authority: decide on SSO/MFA (SEC-13).
3. Repository owner: enable Dependabot and CodeQL (SEC-14).
4. Run `python manage.py check --deploy` on the production host. It must report no issues.
