# Runbook: Deployment, Release and Rollback

## Environments

| Environment | Purpose | Data |
|---|---|---|
| Development | Developers' machines | SQLite, demo data (`seed_demo_cycle`) |
| CI | GitHub Actions on every push and PR | Ephemeral SQLite and PostgreSQL |
| Staging | UAT, pilot rehearsal, DR drills | Copy of production or mock cycle |
| Production | Live ranking cycles | Real institutional data |

A change reaches production only after it is merged to `main` with CI green (backend tests on Python 3.11 and 3.12, PostgreSQL integration, Ruff, the migration drift check, frontend lint, typecheck, tests and build, and Docker builds) and after it has been deployed to staging and smoke-tested there.

## Standard release

1. **Announce** the window to DORA (outside an active submission deadline week).
2. **Back up first** (labelled, so it is easy to find):
   ```bash
   docker compose exec backend python manage.py backup_portal --label pre-release
   ```
3. **Record the current version** for rollback: `git rev-parse HEAD > ../arp-previous-release`.
4. **Deploy:**
   ```bash
   git fetch origin && git checkout <release-tag-or-main-sha>
   docker compose --env-file .env.production up -d --build
   ```
   Migrations run automatically on container start.
5. **Smoke test** (5 minutes):
   - `curl -fsS https://<host>/api/health/` returns `"status":"ok"` and the new `version`.
   - Sign in as Admin; open Dashboard, Data Collection and Go-Live Readiness.
   - Open one public page without signing in.
6. **Record** the release in the MoM email to DORA (version, time, operator).

## Rollback

Use rollback if the smoke test fails or a Severity 1 issue appears after release (see [operations-support](operations-support.md)).

**Code-only rollback** (the release had no migrations, or its migrations are backward compatible):
```bash
git checkout $(cat ../arp-previous-release)
docker compose --env-file .env.production up -d --build
```

**Rollback with data** (the release migrated or corrupted data):
```bash
git checkout $(cat ../arp-previous-release)
docker compose --env-file .env.production up -d --build
docker compose exec backend python manage.py restore_portal /backups/<pre-release archive> --yes
```
Anything entered between the pre-release backup and the restore is lost. Tell DORA which window was affected so departments can re-enter it.

## Hotfix

Branch from the deployed tag, fix, open a PR, wait for CI, merge, then deploy with the standard release steps. Never edit code on the server.
