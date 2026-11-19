# Training Plan

Readiness requires at least one recorded session for **nodal officers** and one for **DORA staff**. The other sessions are recommended. Record each session on **Go-Live Readiness → Backups, DR & Training** (title, audience, date, trainer, attendees).

Run every hands-on session on **staging** with the demo cycle (`manage.py seed_demo_cycle`), never on production data.

## Session 1: Nodal officers (60 min, hands-on)

**Audience:** officers of the pilot departments first, then all departments before the first institute-wide cycle.
**Material:** [Nodal officer guide](../manuals/nodal-officer-guide.md), a staging upload link for each attendee.

| Time | Topic | Exercise |
|---|---|---|
| 0–10 | Why the portal: no more emailed spreadsheets; the evidence lives with the data | — |
| 10–20 | The upload link: personal, expiring, do not forward, newest mail wins | Open your own link |
| 20–35 | Filling a section, drafts, validation messages | Enter one section and fix a deliberate error |
| 35–45 | Excel template import | Import a 10-row file containing 2 bad rows |
| 45–52 | Proofs and versions | Upload a proof, then upload a corrected version |
| 52–60 | Submitting and answering a correction request | Trainer sends a correction; attendee resubmits |

**Done when:** every attendee has submitted one section and answered one correction on staging.

## Session 2: DORA staff (90 min, hands-on)

**Material:** [Admin guide](../manuals/admin-guide.md).

| Topic | Exercise |
|---|---|
| Organogram, roster, programmes | Add and deactivate a test officer |
| Dispatching a request | Dispatch to two sections |
| Progress, reminders, closing | Send a reminder; show that the old link is refused |
| Maker-checker | Approve one section, request a correction on another |
| Cross-checks | Read the anomalies panel; trace one to its submission |
| Rollup and DCS export, briefing | Export the Overall category and open it in Excel |
| Audit log and proofs | Find the correction from earlier in the audit log |
| Go-Live Readiness | Record a UAT result and a flag-review verdict |

## Session 3: Leadership (30 min, demonstration)

Executive dashboard, the briefing PDF, the readiness gates, and how a go/no-go sign-off is recorded. Material: [Leadership guide](../manuals/leadership-guide.md).

## Session 4: Auditors (30 min, demonstration)

Audit log filters and export, proof tracing, and the go-live evidence and sign-off snapshot. Material: [Auditor guide](../manuals/auditor-guide.md).

## Session 5: IT Services (2 h, hands-on)

Installation, configuration, release and rollback, backup, verify and restore, and a DR drill run together. Material: the [runbooks](../runbooks/).

**Done when:** an IT Services engineer has independently deployed staging from scratch, restored a backup into it, and run `dr_drill`.

## After training

Collect questions in the MoM email and fold recurring ones into the manuals.
