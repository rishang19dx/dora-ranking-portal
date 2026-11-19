# Runbook: Backup and Restore

**Targets:** RPO 24 h, RTO 8 h (proposal Appendix B). **Owner:** IT Services.

## 1. What a backup contains

`manage.py backup_portal` writes one archive, `arp-backup-<UTC timestamp>[-label].tar.gz`, plus a `.sha256` sidecar file:

| Member | Content |
|---|---|
| `manifest.json` | Creation time, app version, row count per table, and a SHA-256 for every other member |
| `db.json` | Every database row as Django fixtures. Engine-neutral, so it restores into PostgreSQL or SQLite. |
| `media/…` | The proof repository, byte for byte |

Each backup is verified right after it is written. Archives beyond `BACKUP_RETENTION_COUNT` are pruned. Every backup, restore and drill is recorded in the audit log (`BACKUP`, `RESTORE` and `DR_DRILL` actions).

## 2. Scheduled backups

Run nightly at 01:30 via cron on the Docker host:

```cron
30 1 * * *  cd /srv/arp && docker compose exec -T backend python manage.py backup_portal >> /var/log/arp-backup.log 2>&1
```

**Off-host copy (required).** A backup on the same disk does not survive a host failure. Sync the volume to Institute backup storage after the backup job:

```cron
15 2 * * *  rsync -a --delete "$(docker volume inspect -f '{{.Mountpoint}}' arp_backup_data)/" backup-server:/arp/
```

**Optional native dump.** For a second, independent copy, take a PostgreSQL dump:

```cron
45 1 * * *  cd /srv/arp && docker compose exec -T db pg_dump -U dora_user -Fc dora_db > /srv/arp-pgdump/dora_$(date +\%F).dump
```

## 3. Checking backups

```bash
docker compose exec backend python manage.py verify_backup            # latest
docker compose exec backend python manage.py verify_backup /backups/<archive>
```

The **Backups** card on Go-Live Readiness lists archives. The *Recent backup* gate turns red once the newest archive is older than the RPO target.

Admins can also take an on-demand backup there (**Back up now**). Use it before bulk changes.

## 4. Restore

> **Destructive.** A restore replaces every row and every proof file with the archive's contents. Take a fresh backup of the current state first if any of it might be needed.

```bash
docker compose exec backend python manage.py backup_portal --label before-restore
docker compose exec backend python manage.py restore_portal /backups/<archive>      # type "restore" to confirm
# or non-interactively:
docker compose exec backend python manage.py restore_portal /backups/<archive> --yes
```

The command verifies the archive (checksum, manifest, row counts, safe paths) **before** touching anything. A damaged or tampered archive is refused.

If the archive is on the backup server, copy it and its `.sha256` file into the `backup_data` volume first.

After the restore:
1. `curl -fsS https://<host>/api/health/`
2. Sign in and check the latest submissions and proofs that should be present.
3. Tell DORA what point in time the data now reflects.

## 5. Restoring a PostgreSQL dump instead

```bash
docker compose stop backend
docker compose exec -T db pg_restore -U dora_user -d dora_db --clean --if-exists < dora_YYYY-MM-DD.dump
docker compose start backend
```

Proof files are not in the pg_dump. Restore `media/` from the latest ARP archive, or from the volume copy.
