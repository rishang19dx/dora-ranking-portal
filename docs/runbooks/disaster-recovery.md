# Runbook: Disaster Recovery

| Objective | Target | How it is met |
|---|---|---|
| RPO (maximum data loss) | 24 h | Nightly verified backup, copied off-host |
| RTO (maximum downtime) | 8 h | Container rebuild plus restore. The drill measures it. |

## 1. Scenarios

| Scenario | Response |
|---|---|
| Application container crash | Docker restarts it (`restart: unless-stopped`). Check `docker compose logs backend`. |
| Bad release | [Rollback](deployment.md#rollback) |
| Database corruption or accidental mass change | [Restore](backup-restore.md#4-restore) the last good archive |
| Host lost (disk or VM failure) | Full recovery, §2 |
| Suspected compromise | Isolate the host, inform the Institute Security Authority, rotate `DJANGO_SECRET_KEY` and database credentials, then full recovery on a clean host from a backup taken **before** the compromise |

## 2. Full recovery on a new host

1. Provision a host following [installation §1](installation.md#1-host-prerequisites).
2. Clone the repository at the deployed release tag. Restore `.env.production` from the Institute secrets store.
3. `docker compose --env-file .env.production up -d --build` (this creates an empty, migrated database).
4. Copy the newest archive and its `.sha256` from the backup server into the `backup_data` volume.
5. `docker compose exec backend python manage.py restore_portal /backups/<archive> --yes`
6. Point DNS or the reverse proxy at the new host. Run the release smoke test.
7. Record the incident: when the failure was declared, when service was restored, and the archive used.

## 3. DR drill (pilot KPI: System resilience)

The pilot KPI requires a **witnessed** drill that confirms the RPO and RTO targets. Run it on staging, or on production, since it does not touch live data:

```bash
docker compose exec backend python manage.py dr_drill --witness "Name, Designation"
```

What it does:
1. Takes the latest backup (`--fresh` takes a new one, `--backup <path>` picks a specific one). RPO is measured from that backup's creation time to the moment the drill starts.
2. Verifies the archive.
3. Migrates a **scratch** SQLite database in a temporary folder and restores the archive into it, proof files included.
4. Checks that every table's row count and the number of proof files match the manifest.
5. Records the drill (RPO, RTO, integrity, witness) and adds a `DR_DRILL` audit entry. It exits non-zero if any target is missed.

The result shows on Go-Live Readiness under *System resilience*.

**Full-stack drill (recommended once before go-live).** Perform §2 on a spare VM with the witness present, timing it end to end. Record the times through the API (`POST /api/golive/dr-drills/` with `backupName`, `backupCreatedAt`, `failureDeclaredAt`, `restoredAt`, `integrityOk` and `witnessedBy`) or ask a developer to add it in the Django admin.

Repeat the drill every six months and after any infrastructure change.
