# Runbook: Operations, Support and Escalation

## Responsibility allocation (proposal §11)

| Domain | Accountable owner |
|---|---|
| Business policy and content: NIRF reporting logic, nodal officer rosters, resolving flagged discrepancies | **DORA** |
| Platform operations: hosting, domain, backups, incident response | **IIT Mandi IT Services** (or designated technical unit) |
| Data protection and security: annual penetration test, access reviews | **IIT Mandi Security Authority** |

## Support hours

- **Business hours:** Monday to Friday, 09:30–17:30 IST, through the IT Services helpdesk.
- **Submission deadline weeks** (announced by DORA): IT Services monitors health twice a day, and Severity 1 issues are handled the same day.

## Severity levels

| Severity | Definition | Examples | Response | Resolution target |
|---|---|---|---|---|
| **S1: Critical** | Portal down, data loss or corruption, security breach | `/api/health/` failing; proofs missing; unauthorised access | 1 business hour | Workaround or rollback within 8 h (RTO) |
| **S2: High** | A core workflow blocked for many users, no workaround | Upload links failing; export errors; mail not sending | 4 business hours | 2 business days |
| **S3: Medium** | A feature misbehaves and a workaround exists | One dashboard chart wrong; a reminder sent twice | 1 business day | Next scheduled release |
| **S4: Low** | Cosmetic issue or question | Typo; how-to question | 3 business days | Backlog |

## Escalation path

1. **Reporter** (nodal officer or DORA staff) → DORA data officer
2. **DORA data officer** → IT Services helpdesk ticket, with severity, screenshot and time
3. **IT Services on-duty engineer** → triage using this runbook; S1/S2 → IT Services lead
4. **IT Services lead** → Dean, DORA (business impact) and the Institute Security Authority (any security event)

Contacts are kept in the Institute directory under ARP Operations, not in this repository.

## Routine checks

| When | Check | Command / place |
|---|---|---|
| Daily | Health | `curl -fsS https://<host>/api/health/` (add to campus monitoring) |
| Daily | Last night's backup succeeded | `/var/log/arp-backup.log`; *Recent backup* gate |
| Weekly | Disk space on data and backup volumes | `df -h`, `docker system df` |
| Monthly | Verify an older archive from the backup server | `manage.py verify_backup <archive>` |
| Each cycle | Upload-link expiry fits the cycle deadline | `PORTAL_ACCESS_TTL_DAYS` |
| 6-monthly | DR drill | [disaster-recovery §3](disaster-recovery.md#3-dr-drill-pilot-kpi-system-resilience) |
| Yearly | Access review: deactivate users who have left; penetration test | Django admin → Users |

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend restarting, log says `DJANGO_SECRET_KEY must be set` | Missing or weak key in `.env.production` | Set a 64-character key, restart |
| `400 Bad Request` on every page | Host not in `DJANGO_ALLOWED_HOSTS` | Add it, restart |
| Django admin login fails with CSRF error | `CSRF_TRUSTED_ORIGINS` missing the https origin | Add it, restart |
| Officers say links do not arrive | No `RESEND_API_KEY` (mail is SIMULATED), or mail blocked | Check the request's delivery status; set the key or whitelist the sender |
| Old upload link refused | The link was rotated by a reminder, revoked, or expired | Expected behaviour. The newest mail holds the valid link. |
| Login says "Request was throttled" | 10 attempts per minute from one IP | Wait a minute. On a shared NAT, raise `LOGIN_THROTTLE_RATE`. |

## Post-deployment support by the Development Team

After handover the Development Team provides best-effort support for the post-deployment period agreed with DORA. Scope: S1/S2 bug fixes and knowledge transfer, through the Institute GitHub repository's issues. New features follow the change process in proposal §2 (written prior approval).
