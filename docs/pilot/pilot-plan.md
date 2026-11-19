# Controlled Pilot and Go / No-Go Plan

Proposal §3.3: before a campus-wide launch, a closed pilot with selected departments must meet three measurable KPIs, followed by a formal go/no-go decision.

## 1. Scope

- **Departments:** 3–5 sections chosen by DORA, ideally one school, one central data owner (for example SRIC or Training & Placement), and one administrative section, so that every form type is exercised.
- **Cycle:** the real upcoming NIRF cycle data for those sections, in production or in a production-like staging environment.
- **Duration:** about two weeks of collection, plus one week of review.

## 2. Running it in the portal

1. **Dispatch** a data request to the pilot sections (Data Collection).
2. **Go-Live Readiness → Pilot & KPIs → Create pilot**, choosing that request. Its target sections become the pilot scope.
3. **Start pilot.** Officers submit; DORA reviews with maker-checker as normal.
4. When submissions are in, press **Run checks** for the request. Every automated cross-check result is queued for review.
5. For each check, a DORA reviewer who knows the data records the ground truth:
   - **System correct**: the flag was a real discrepancy, or the pass was genuinely clean.
   - **System wrong**: a false alarm, or a discrepancy the system missed. A reason is required.
6. IT Services runs a **witnessed DR drill** (`manage.py dr_drill --witness "…"`).
7. When the evidence is complete, **Complete pilot**. This freezes the pilot's evidence.

## 3. KPIs and how they are computed

| KPI | Target | Computed from |
|---|---|---|
| **AI reliability** | Accuracy > 95% **and** 0 false positives on critical checks | Reviewer verdicts. Accuracy = (correct flags + correct passes) / all reviewed checks. A *critical* check is one of `error` severity. Pending verdicts keep the KPI red. |
| **Data auditability** | 100% | For pilot submissions: every audit row must name an actor that resolves to a real officer or user, and every modification visible in the data (edits, submissions, reviews) must have its audit entry. Any exception is listed by ID. |
| **System resilience** | Witnessed drill with RPO ≤ 24 h and RTO ≤ 8 h, integrity verified | The most recent witnessed DR drill |

All three appear on the Readiness tab with their evidence.

> **Note on "AI".** In this release the discrepancy flags come from deterministic cross-checks (`apps/submissions/cross_checks.py`), not a language model. The KPI measures whatever produces the flags, so it stays valid if an AI-assisted check is added later. If one is, its requests must be logged and its flags must be grounded in portal data (proposal §9).

## 4. Readiness gates

The recommendation is **GO** only when every gate passes:

1. Controlled pilot completed
2. KPI: AI reliability
3. KPI: Data auditability
4. KPI: System resilience
5. UAT: every scenario passing
6. DORA UAT sign-off
7. Training: nodal officers and DORA staff
8. A backup newer than the RPO target, with its checksum
9. Production security configuration (DEBUG off, strong secret key, explicit hosts, no wildcard CORS, secure cookies)

## 5. The decision

The Director or Dean records **Go / no-go decision** on the Sign-off tab. The full readiness payload at that moment is stored with the decision. Approving against a NO-GO recommendation requires a written justification (for example, an accepted risk with a mitigation and an owner).

**After GO:** the remaining departments are onboarded (training session 1, roster check) and the first institute-wide request is dispatched.
**After NO-GO:** fix the failing gates, extend or repeat the pilot, and decide again.
