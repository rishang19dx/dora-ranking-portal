# ARP Handover Documentation (Phase 4)

These documents go with the handover of the Automated Ranking Portal (ARP) to DORA and IIT Mandi IT Services. They cover the Phase 4 deliverables in the proposal: production deployment, technical and user documentation, training, UAT, the controlled pilot and go/no-go, and post-deployment support.

| Audience | Start here |
|---|---|
| IT Services (operations) | [Installation](runbooks/installation.md) → [Configuration](runbooks/configuration.md) → [Deployment & release](runbooks/deployment.md) → [Backup & restore](runbooks/backup-restore.md) → [Disaster recovery](runbooks/disaster-recovery.md) → [Operations & support](runbooks/operations-support.md) |
| DORA staff (Admin) | [Admin guide](manuals/admin-guide.md), [UAT plan](uat/uat-plan.md), [Pilot plan](pilot/pilot-plan.md) |
| Department nodal officers | [Nodal officer guide](manuals/nodal-officer-guide.md) |
| Director / leadership | [Leadership guide](manuals/leadership-guide.md) |
| Internal auditors | [Auditor guide](manuals/auditor-guide.md) |
| Trainers | [Training plan](training/training-plan.md) |
| Security authority | [Security audit](security/security-audit.md), [Data inventory](data-inventory.md) |
| Everyone signing off | [Handover checklist](handover-checklist.md) |

## Where Phase 4 lives in the product

- **Go-Live Readiness** page (`/admin/go-live`): readiness gates, the three pilot KPIs, flag-review ground truth, UAT results, backups, DR drills, training records and the sign-off register.
- **API**: `/api/golive/...` (Admin/Director write, Auditor read) and `/api/health/` (public liveness check).
- **Management commands**: `backup_portal`, `verify_backup`, `restore_portal`, `dr_drill`, `seed_uat_scenarios`.
- **Code**: `backend/apps/golive/`, `frontend/src/views/admin/AdminGoLive.tsx`.

## Out of scope

QS, THE and MDRA schema mappings and exports are not part of this phase. Pushing data directly into agency portals is out of scope for the whole engagement (proposal §2, Out of Scope).
