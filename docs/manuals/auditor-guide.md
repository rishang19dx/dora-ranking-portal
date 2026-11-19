# User Manual: Internal Auditor

You have read-only access to the audit log, the proof repository, submissions, exports and the go-live evidence. You cannot change data.

## Audit Log

**Audit Log** lists every create, edit, import, submit, approve, reject, correction request, reopen and export, plus platform events (backup, restore, DR drill, pilot changes, flag reviews, UAT results, training records, sign-offs).

- **Filter** by action, actor type (nodal officer, DORA staff, system), date range, or free text (values, comments, sections).
- **Expand** a row to see each field's old and new value. Personal fields (names, emails, employee IDs) show as `[redacted]`: the change is visible, the values are not.
- **Export CSV** downloads the filtered set. The export is itself logged.

Entries cannot be edited or deleted, by anyone, through any interface.

## Tracing a figure to its proof

1. In **Proof Repository**, search by section, unit, request, cycle or data item.
2. Each proof shows its version history and the submission it supports.
3. **Download** re-checks the file against its stored SHA-256 and refuses a file that has changed on disk.

## Exports

Every DCS export and CSV export is logged with its SHA-256, so a file handed to you can be matched to the exact export event.

## Go-live evidence

**Go-Live Readiness** (read-only for you) shows the pilot KPIs and the evidence behind them:
- **AI reliability**: each automated check with the system's answer and the reviewer's verdict.
- **Data auditability**: any audit row whose actor cannot be resolved, or any state change with no audit entry, is listed by ID.
- **System resilience**: DR drills with measured RPO and RTO, and the witness.

The sign-off register stores the full readiness snapshot that existed at the moment of each signature (`GET /api/golive/signoffs/?snapshot=1`).
