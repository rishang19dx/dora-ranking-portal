# Data Inventory

Proposal §9 (data minimisation and transparency): every category of data the portal stores, why it is stored, how long it is kept, and how it is deleted. DORA owns this inventory and must review it whenever a new form field is added.

Retention periods are **proposed defaults for DORA approval**. The platform does not delete anything automatically, except backup archives beyond `BACKUP_RETENTION_COUNT`.

| Data | Where (table / store) | Personal? | Purpose | Retention (proposed) | Deletion action |
|---|---|---|---|---|---|
| Staff accounts: username, name, email, phone, role, password hash | `accounts_user` | Yes | Sign-in and role-based access | While employed in the role, plus 1 year | Deactivate on leaving; delete after 1 year via Django admin (audit rows keep the numeric ID only) |
| Nodal officers: name, email, phone, unit | `organogram_nodalofficer` | Yes | Sending requests and attributing submissions | While designated, plus 1 year | Set to inactive; delete via the Nodal Officers page |
| Organogram and programmes | `organogram_*` | No | Institutional structure | Indefinite | Edit in place |
| Data requests, targets, deliveries | `data_requests_*` | Officer email in delivery records | Cycle management and delivery proof | 5 years (3-year history requirement plus margin) | Delete the request via Django admin; cascades to targets and deliveries |
| Upload-link grants | `data_requests_portalaccessgrant` | No (hash only) | Token-scoped access | Expire after `PORTAL_ACCESS_TTL_DAYS` | Revoked or expired grants can be purged after the cycle |
| Section submissions and records | `submissions_sectionsubmission`, `submissions_submissionrecord` | **Some fields** (schema fields flagged `pii`, such as faculty names and employee IDs) | Ranking data and agency export | 5 years | Cycle-level deletion via Django admin, on DORA's written instruction |
| Proof documents | `media/proofs/`, `data_requests_proofupload` | May contain personal data (award letters, for example) | Evidence for submitted figures | 5 years | Delete the record and the file together. Backups age out under retention. |
| Audit log | `submissions_submissionauditlog` | Actor IDs; PII values redacted | Integrity and provenance | Indefinite (append-only) | Not deletable through the application, by design |
| Go-live records (pilot, flag reviews, UAT, drills, training, sign-offs) | `golive_*` | Tester, trainer and signatory names | Phase 4 acceptance evidence | Indefinite | Sign-offs are immutable. Others can be deleted via Django admin. |
| Public ranking datasets | `rankings_*`, scraped JSON | No | Public trends and comparisons | Indefinite | Re-scrape or replace |
| Mail outbox (when no mail provider is set) | `PORTAL_DATA_DIR/outbox/` | Officer emails and message bodies | Dispatch record without a live mail provider | 90 days | Delete files older than 90 days (cron) |
| Backups | `BACKUP_DIR`, off-host copy | Everything above | Disaster recovery | Last `BACKUP_RETENTION_COUNT` local copies; off-host per IT policy | Automatic pruning locally; IT policy off-host |
| Application logs | Container stdout | IP addresses, usernames on failed login | Operations and security | 90 days | Docker log rotation |

## Principles applied

- Collect only the fields the NIRF form schema needs. New personal fields must be flagged `pii` in the schema, which redacts them from the audit trail automatically.
- Personal data is never sent to external AI services. The current discrepancy checks run entirely inside the portal.
- Upload tokens are stored only as SHA-256 hashes.
- Production data is accessed only for support, by IT Services, under Institute policy.
