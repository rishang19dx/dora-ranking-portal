# User Acceptance Testing (UAT) Plan

**Goal:** DORA staff confirm, using the real product on staging, that ARP does what the proposal promises for Phases 1–3 (QS/THE/MDRA mappings excluded). UAT ends with a formal **UAT sign-off** on Go-Live Readiness.

## Environment

- Staging, deployed from the release candidate tag with `DJANGO_DEBUG=False`.
- Data: the mock NIRF cycle (`manage.py seed_demo_cycle`) plus requests created during testing.
- Accounts: one each for ADMIN, DIRECTOR and AUDITOR; staging upload links for officers.
- Mail: a test `RESEND_API_KEY` delivering to tester mailboxes, or the SIMULATED outbox.

## Scenarios

The script is loaded into the portal (`manage.py seed_uat_scenarios`) and listed on **Go-Live Readiness → UAT**, with steps and expected results. Summary:

| Code | Area | Role | Priority | Scenario |
|---|---|---|---|---|
| UAT-01 | Access | Admin | Critical | Sign-in, role dashboards, login throttling |
| UAT-02 | Organogram | Admin | High | Browse and search the hierarchy |
| UAT-03 | Nodal officers | Admin | High | Maintain the roster |
| UAT-04 | Data collection | Admin | Critical | Dispatch a targeted NIRF request |
| UAT-05 | Officer portal | Officer | Critical | Fill, save, prove and submit a section |
| UAT-06 | Officer portal | Officer | High | Excel template import |
| UAT-07 | Validation | Admin | Critical | Rule-based validation and cross-check flags |
| UAT-08 | Maker-checker | Admin | Critical | Correction request → resubmission → approval |
| UAT-09 | Audit | Auditor | Critical | Trace a change; export the audit log |
| UAT-10 | Proofs | Auditor | High | Open the proof behind a figure |
| UAT-11 | Export | Admin | Critical | NIRF DCS export matches the rollup |
| UAT-12 | Reminders | Admin | High | Reminders reach pending sections only and rotate links |
| UAT-13 | Analytics | Director | High | Executive dashboards and briefing PDF |
| UAT-14 | Analytics | Officer | Normal | Department head sees only their own analytics |
| UAT-15 | Public portal | Public | High | Ranking trends without login |
| UAT-16 | Access | Officer | Critical | Role isolation and expired/revoked links |
| UAT-17 | Operations | Admin | Critical | Backup and restore drill |

## Recording results

For each scenario the tester presses **PASS**, **FAIL** or **BLOCKED**. A failure or block needs notes and, ideally, a GitHub issue reference. Every attempt is kept as history, and the latest result counts. Re-test after each fix.

## Defect severity

Uses the [support severity scale](../runbooks/operations-support.md#severity-levels). S1 and S2 defects must be fixed and re-tested before sign-off. S3 and S4 can be accepted into the backlog, noted in the sign-off comment.

## Exit criteria

1. Every active scenario's latest result is **PASS** (this turns the *User acceptance testing* gate green).
2. No open S1 or S2 defects.
3. The Dean, DORA (or delegate) records **UAT sign-off → Approve**, listing any accepted S3/S4 items in the comment.
