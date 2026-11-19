# Handover Checklist (Phase 4 Acceptance)

Phase 4 acceptance criteria (proposal §5.4): DORA formally signs off UAT; handover of the Institute-controlled repository is complete; user manuals are provided; the service runs without depending on the Development Team.

Tick each item and record **Handover acceptance** on Go-Live Readiness → Sign-off when all are done.

## Repository and ownership

- [ ] Source code is in the DORA-owned GitHub repository; Development Team members' admin rights are removed or downgraded
- [ ] `main` is protected (PR review plus green CI required)
- [ ] Production database, storage volumes, domain and deployment host are under Institute accounts only
- [ ] `.env.production` is stored in the Institute secrets store, not on personal machines

## Deployment

- [ ] Staging deployed by IT Services from scratch using [installation](runbooks/installation.md), without Development Team help
- [ ] Production deployed; `/api/health/` added to campus monitoring
- [ ] *Production security configuration* gate green; `manage.py check --deploy` clean on production
- [ ] TLS in place; `/admin/` restricted to campus IPs ([security audit](security/security-audit.md), residual actions)

## Backup and recovery

- [ ] Nightly `backup_portal` cron and the off-host copy are running ([backup-restore §2](runbooks/backup-restore.md#2-scheduled-backups))
- [ ] A restore performed by IT Services on staging
- [ ] Witnessed DR drill recorded; *System resilience* KPI green

## Acceptance

- [ ] All UAT scenarios passing; **UAT sign-off** recorded
- [ ] Controlled pilot completed; all three KPIs green
- [ ] **Go / no-go decision** recorded by the Director or Dean
- [ ] Training sessions held and recorded (nodal officers, DORA staff; leadership, auditors and IT recommended)

## Documentation delivered

- [ ] Runbooks: installation, configuration, deployment and rollback, backup and restore, disaster recovery, operations and support
- [ ] User manuals: admin, nodal officer, leadership, auditor
- [ ] Training plan, UAT plan, pilot plan, security audit, data inventory

## Open items carried forward

Record any accepted residual items (for example SEC-13 SSO/MFA, SEC-14 dependency scanning, and the QS/THE/MDRA exports that are outside this phase) in the handover sign-off comment, each with an owner.
