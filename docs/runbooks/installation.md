# Runbook: Installation

**Owner:** IIT Mandi IT Services · **Applies to:** staging and production

ARP runs as five containers: PostgreSQL 16, the Django API (gunicorn), Nginx serving the React SPA and proxying `/api/`, and two background workers: `scheduler` (fetches newly published NIRF cycles daily) and `reminders` (sends deadline reminders hourly). The workers start once the backend is healthy. Every piece runs on Institute-provisioned servers. No external cloud service is required. The optional mail provider (Resend) is the only outbound dependency, and without it mail is written to an outbox folder.

## 1. Host prerequisites

| Item | Minimum |
|---|---|
| OS | Any Linux with Docker Engine 24+ and the Compose plugin |
| CPU / RAM | 2 vCPU / 4 GB (pilot); 4 vCPU / 8 GB (institute-wide cycle) |
| Disk | 40 GB for the data volume, plus backup space (see [backup-restore](backup-restore.md)) |
| Network | Inbound 443 (TLS terminated by the campus reverse proxy or a host Nginx). The app container listens on `HTTP_PORT` (default 3000). |
| DNS / TLS | A host name such as `arp.iitmandi.ac.in` with an Institute certificate |

## 2. First installation

```bash
git clone <institute-repo-url> arp && cd arp
cp .env.production.example .env.production
# Edit .env.production: DJANGO_SECRET_KEY, POSTGRES_PASSWORD, DORA_ADMIN_PASSWORD, DJANGO_ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, APP_BASE_URL
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # paste into DJANGO_SECRET_KEY
docker compose --env-file .env.production up -d --build
```

On start, the backend container runs (all idempotent): `migrate`, `seed_organogram`, `load_form_schema`, `seed_uat_scenarios`, `ensure_admin` (when `DORA_ADMIN_PASSWORD` is set), `collectstatic`, then gunicorn.

The backend **refuses to start** if `DJANGO_DEBUG=False` and the secret key is missing, is the development key, or is shorter than 50 characters. This is intentional.

## 3. Accounts and roles

The bootstrap Admin account comes from `DORA_ADMIN_USERNAME` / `DORA_ADMIN_PASSWORD`. If you are locked out, run:

```bash
docker compose exec backend python manage.py ensure_admin --reset-password
```

Sign in to the portal as that Admin, open **Users & Roles**, and create an account for each staff member with the right **role**:

| Role | Who |
|---|---|
| `ADMIN` | DORA data officers |
| `DIRECTOR` | Director / Dean (read-only dashboards, sign-offs) |
| `AUDITOR` | Internal audit (read-only audit log, proofs, go-live evidence) |
| `NODAL_OFFICER` | Department heads who use *My Analytics* (scoped to their own unit). Data entry itself uses mailed links, not accounts. |

Every API endpoint denies access unless a role is explicitly allowed. Director and Auditor are read-only everywhere, except that the Director records go-live sign-offs.

## 4. Verify the installation

```bash
curl -fsS https://<host>/api/health/          # {"status":"ok","database":"ok",...}
docker compose ps                              # backend "healthy"; db, frontend, scheduler, reminders running
docker compose exec backend python manage.py check --deploy
```

Then sign in as an Admin, open **Go-Live Readiness** and confirm that the *Production security configuration* gate is green.

## 5. Schedule backups (mandatory)

Follow [backup-restore.md §2](backup-restore.md#2-scheduled-backups) before loading real data.

## 6. Local development (developers only)

See the repository `README.md` for running against SQLite with `DJANGO_DEBUG=True`.
