# User Manual: DORA Staff (Admin)

You run the ranking cycle: you choose who is asked for what, review what comes back, approve it, and produce the NIRF export.

## 1. Signing in

Open the portal, choose **Admin login**, and use the account IT Services created for you. Ten wrong passwords in a minute from one computer pause logins for that minute.

## 2. The cycle at a glance

```
Organogram + roster ready → Dispatch request → Officers fill forms → Review (maker-checker)
      → Cross-checks clean → Rollup → NIRF DCS export → Director sign-off → manual upload to NIRF
```

## 3. Before a cycle

1. **Organogram**: confirm the hierarchy and each section's contact details.
2. **Nodal Officers**: every section that will be asked for data needs at least one active officer. The coverage indicators show any gaps.
3. **Programmes**: check the degree programme registry (it drives intake and placement rows). Bulk import is available from CSV/XLSX.

## 4. Dispatching a request

**Data Collection → New request**

1. Select the sections in the organogram tree (a whole school can be selected at once).
2. Choose the NIRF categories. The required metrics for each section are preselected; adjust them if needed.
3. Set the deadline, check the subject and message, and **Dispatch**.

Each officer receives a mail with a **personal upload link**. The link only opens that section's forms for that request.

## 5. Following progress

Open the request from **Data Collection**:
- **Collection Progress** and **Missing Units** show who has not submitted.
- **Send reminders** mails pending or partial sections only. Each reminder replaces the officer's link, so the old link stops working.
- Reminders are also sent automatically before the deadline (7, 3 and 1 days by default) and after it. **Reminders** shows the timeline and lets you pause a request's automated reminders.
- **Close** the request once the cycle is done. Reopen it if a late correction is needed.

## 6. Reviewing submissions (maker-checker)

On the request page, under **Maker-Checker Actions**, each submitted section can be:

| Action | When | Effect |
|---|---|---|
| **Approve** | Data is correct | Final. Only approved data is counted and exported. |
| **Request correction** | A flagged error needs fixing | Goes back to the officer with your comment (required) |
| **Reject** | The submission is unacceptable | Same flow, recorded as a rejection (comment required) |
| **Reopen** | An approved section must change | Unlocks it as a draft. Audited. |

Faculty details also need each school's confirmation before they can be approved.

**Cross-Check Anomalies** lists automated discrepancy checks (for example, the sponsored-project register against SRIC totals), each with a severity. While you review, each figure shows the previous cycle's approved value and the change.

**Discrepancies** lists every flag across the cycle, graded Critical or Warning: large year-on-year moves, restated earlier-year figures, record-count swings and failed cross-checks. For each flag, either **escalate** it (this sends a correction request to the department) or **dismiss** it with a note. If an AI provider is configured, **Scan + AI review** adds a second opinion beside each flag. Resolve critical flags before exporting.

## 7. Exporting

From the cycle rollup, export the **NIRF DCS workbook** per category. Totals match the rollup screen and include approved data only. Every export is logged with a SHA-256 of the file. The **Boardroom briefing** PDF summarises the cycle for the Director.

## 8. Users and rankings

- **Users & Roles**: create staff accounts and set each one's role (Admin, Director, Auditor, Nodal Officer).
- **Public Rankings**: enter IIT Mandi's QS, THE and MDRA results. Published ones appear on the public portal next to NIRF.
- **Rankings (NIRF)**: NIRF cycles are fetched automatically each day. **Fetch** pulls a newly published cycle immediately.

## 9. Evidence and audit

- **Proof Repository**: every uploaded document, searchable, versioned, and linked to the figures it supports.
- **Audit Log**: every change with its old and new value, actor and time. Personal fields are redacted.

## 10. Go-Live Readiness (Phase 4)

Used during the pilot and at handover. See the [pilot plan](../pilot/pilot-plan.md) and [UAT plan](../uat/uat-plan.md).

| Tab | You do |
|---|---|
| Readiness | Read the gates and the GO / NO-GO recommendation |
| Pilot & KPIs | Set up the pilot, run checks, mark each check **System correct** or **System wrong** |
| UAT | Record PASS / FAIL / BLOCKED per scenario (notes are required for a failure) |
| Backups, DR & Training | Take an on-demand backup; record training sessions; view DR drills |
| Sign-off | Record UAT sign-off, the go/no-go decision and handover acceptance. These cannot be edited. |

## 11. Getting help

Report problems to IT Services with the severity, a screenshot and the time. See [operations-support](../runbooks/operations-support.md).
