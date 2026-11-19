# Runbook: Configuration Reference

All configuration comes from environment variables in `.env.production` (git-ignored; template `.env.production.example`). Restart the backend after any change: `docker compose --env-file .env.production up -d backend`.

## Security

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | **yes** | none | ≥ 50 random characters. It signs every login token, so rotating it signs everyone out. |
| `DJANGO_DEBUG` | **yes** | `True` | Must be `False` in staging and production. |
| `DJANGO_ALLOWED_HOSTS` | **yes** | `localhost,127.0.0.1` when DEBUG is off | Comma-separated host names. |
| `CSRF_TRUSTED_ORIGINS` | yes | empty | e.g. `https://arp.iitmandi.ac.in`. Needed for the Django admin over HTTPS. |
| `CORS_ALLOWED_ORIGINS` | no | empty | Leave empty when the SPA and API share an origin (the standard deployment). |
| `DJANGO_SECURE_SSL_REDIRECT` | no | `True` | Set `False` only on a plain-HTTP internal staging host. |
| `DJANGO_SECURE_COOKIES` | no | `True` | As above. |
| `DJANGO_HSTS_SECONDS` | no | `31536000` | Set `0` while you are still testing TLS. |
| `LOGIN_THROTTLE_RATE` | no | `10/min` | Login attempts allowed per client IP. |

## Database

| Variable | Notes |
|---|---|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Used by compose for both the database and the backend `DATABASE_URL`. |
| `DATABASE_URL` | Set automatically in compose. For a non-container install use `postgres://user:pass@host:5432/db`. Without it, SQLite is used (development only). |

## Mail and links

| Variable | Notes |
|---|---|
| `APP_BASE_URL` | Public URL used in the upload links mailed to nodal officers. |
| `MAIL_FROM` | Sender shown on requests and reminders. |
| `RESEND_API_KEY` | Without it, mail goes to `PORTAL_DATA_DIR/outbox/` and shows as SIMULATED in the UI. |
| `PORTAL_ACCESS_TTL_DAYS` | Upload-link lifetime (default 45). |

## Backup and DR

| Variable | Default | Notes |
|---|---|---|
| `BACKUP_DIR` | `/backups` in compose | Mounted as the `backup_data` volume. Copy it off-host as well (see backup runbook). |
| `BACKUP_RETENTION_COUNT` | `14` | Archives kept locally; older ones are pruned after each backup. |
| `DR_TARGET_RPO_HOURS` | `24` | Agreed recovery point objective. |
| `DR_TARGET_RTO_HOURS` | `8` | Agreed recovery time objective. |
| `KPI_FLAG_ACCURACY_TARGET` | `0.95` | Pilot AI-reliability threshold (accuracy must be strictly greater). |
| `APP_VERSION` | `2.0.0` | Shown in `/api/health/` and on the readiness page. Bump it on each release. |

## Logging

| Variable | Default |
|---|---|
| `DJANGO_LOG_LEVEL` | `INFO` |

Logs go to stdout: `docker compose logs -f backend`. Security events (`django.security`) are logged at WARNING and above.
