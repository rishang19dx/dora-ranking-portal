"""
The UAT script DORA staff execute before sign-off (docs/uat/uat-plan.md).

One entry per business scenario, covering every Phase 1-3 deliverable that
real users touch. `seed_uat_scenarios` loads these idempotently; recorded
executions survive a re-seed.
"""

SCENARIOS = [
    {
        'code': 'UAT-01', 'area': 'Access', 'role': 'ADMIN', 'priority': 'CRITICAL',
        'title': 'Sign in and land on the role-appropriate dashboard',
        'steps': [
            'Open the portal and choose "Admin login".',
            'Sign in with a DORA staff account.',
            'Sign out, then sign in as a Director, then as an Auditor.',
        ],
        'expected': 'Each role lands on its dashboard; the sidebar shows only that role\'s pages; '
                    'ten rapid wrong passwords are throttled.',
    },
    {
        'code': 'UAT-02', 'area': 'Organogram', 'role': 'ADMIN', 'priority': 'HIGH',
        'title': 'Browse the institute organogram and find a section',
        'steps': ['Open Organogram.', 'Search for "Computing".', 'Expand the school and open a section.'],
        'expected': 'The hierarchy matches the institute structure; contact and nodal officer details are shown.',
    },
    {
        'code': 'UAT-03', 'area': 'Nodal officers', 'role': 'ADMIN', 'priority': 'HIGH',
        'title': 'Maintain the nodal officer roster',
        'steps': ['Open Nodal Officers.', 'Add an officer to a department.', 'Edit the email, then deactivate.'],
        'expected': 'Changes are saved and coverage indicators update immediately.',
    },
    {
        'code': 'UAT-04', 'area': 'Data collection', 'role': 'ADMIN', 'priority': 'CRITICAL',
        'title': 'Dispatch a targeted NIRF data request',
        'steps': [
            'Open Data Collection and start a new request.',
            'Select two pilot departments in the organogram and the NIRF categories.',
            'Review the required metrics, set a deadline and dispatch.',
        ],
        'expected': 'One target per section is created, each officer receives a mail with a unique upload link, '
                    'and the request appears in the compliance list with its deadline.',
    },
    {
        'code': 'UAT-05', 'area': 'Nodal officer portal', 'role': 'NODAL_OFFICER', 'priority': 'CRITICAL',
        'title': 'Fill and submit a section through the upload link',
        'steps': [
            'Open the link from the request mail.',
            'Fill a section, save a draft, reload and confirm the draft persisted.',
            'Upload a supporting proof and submit the section.',
        ],
        'expected': 'Validation errors block submission until fixed; previous approved values and the change '
                    'are shown beside each field; the submitted section becomes read-only and appears as '
                    'SUBMITTED in the DORA review queue.',
    },
    {
        'code': 'UAT-06', 'area': 'Nodal officer portal', 'role': 'NODAL_OFFICER', 'priority': 'HIGH',
        'title': 'Bulk-import records from the standardised Excel template',
        'steps': ['Download the section template.', 'Fill 20 rows offline.', 'Import the file.'],
        'expected': 'All valid rows import; invalid rows are reported with row numbers and reasons.',
    },
    {
        'code': 'UAT-07', 'area': 'Validation', 'role': 'ADMIN', 'priority': 'CRITICAL',
        'title': 'Validation and discrepancy flags',
        'steps': [
            'Submit a section with a placement percentage above 100.',
            "Submit a figure 85% lower than last cycle's approved value.",
            'Open Discrepancies; escalate one flag and dismiss another with a note.',
        ],
        'expected': 'The impossible value is rejected at entry; the drop is flagged CRITICAL and links to its '
                    'submission; escalating sends a correction request; the dismissal note is kept.',
    },
    {
        'code': 'UAT-08', 'area': 'Maker-checker', 'role': 'ADMIN', 'priority': 'CRITICAL',
        'title': 'Request a correction and approve the resubmission',
        'steps': [
            'Open a submitted section and request a correction with a comment.',
            'As the nodal officer, correct and resubmit.',
            'As DORA, approve the resubmission.',
        ],
        'expected': 'Status moves SUBMITTED -> CORRECTION_REQUESTED -> SUBMITTED -> APPROVED; '
                    'data is only counted once approved.',
    },
    {
        'code': 'UAT-09', 'area': 'Audit', 'role': 'AUDITOR', 'priority': 'CRITICAL',
        'title': 'Trace a change in the audit log and export it',
        'steps': ['Sign in as Auditor.', 'Filter the audit log by the request from UAT-08.', 'Export CSV.'],
        'expected': 'Every edit, submission and decision is listed with old/new value, actor and time; '
                    'personal fields are redacted; the export itself appears as an EXPORT entry.',
    },
    {
        'code': 'UAT-10', 'area': 'Proofs', 'role': 'AUDITOR', 'priority': 'HIGH',
        'title': 'Open the source proof behind a reported figure',
        'steps': ['Open the Proof Repository.', 'Search for a proof uploaded in UAT-05.', 'Download it.'],
        'expected': 'The file downloads intact (checksum verified) and is linked to its submission and version.',
    },
    {
        'code': 'UAT-11', 'area': 'Export', 'role': 'ADMIN', 'priority': 'CRITICAL',
        'title': 'Generate the NIRF DCS export',
        'steps': ['Open the cycle rollup.', 'Export the DCS workbook for the Overall category.'],
        'expected': 'The workbook opens in Excel with IIT Mandi headings and only approved data; '
                    'totals match the rollup screen.',
    },
    {
        'code': 'UAT-12', 'area': 'Reminders', 'role': 'ADMIN', 'priority': 'HIGH',
        'title': 'Manual and scheduled reminders',
        'steps': ['Open a request with pending targets.', 'Send reminders.',
                  'Open Reminders, check the schedule, then pause it.'],
        'expected': 'Only pending/partial targets are reminded, the old link stops working, the automated '
                    'schedule shows upcoming reminders, and a paused request sends none.',
    },
    {
        'code': 'UAT-13', 'area': 'Analytics', 'role': 'DIRECTOR', 'priority': 'HIGH',
        'title': 'Review executive dashboards and the boardroom briefing',
        'steps': ['Sign in as Director.', 'Open the executive dashboard and parameter trends.', 'Download the briefing PDF.'],
        'expected': 'Historical trends and peer gaps render; the PDF lists submission statistics and discrepancies.',
    },
    {
        'code': 'UAT-14', 'area': 'Analytics', 'role': 'NODAL_OFFICER', 'priority': 'NORMAL',
        'title': 'Department head views own analytics',
        'steps': ['Sign in as a department nodal officer.', 'Open My Analytics.'],
        'expected': 'Only the officer\'s own department is shown in detail; other departments are anonymised.',
    },
    {
        'code': 'UAT-15', 'area': 'Public portal', 'role': 'PUBLIC', 'priority': 'HIGH',
        'title': 'Public visitor views ranking trends without signing in',
        'steps': ['Open the portal in a private window.',
                  'Browse NIRF trends, 2nd-generation IIT comparisons and the QS/THE/MDRA results DORA has published.'],
        'expected': 'Charts load without login; no administrative data or links are exposed.',
    },
    {
        'code': 'UAT-16', 'area': 'Access', 'role': 'NODAL_OFFICER', 'priority': 'CRITICAL',
        'title': 'Role isolation holds',
        'steps': [
            'With an officer link for department A, try to open department B\'s forms.',
            'As Auditor, try to approve a submission.',
            'Open an expired or revoked upload link.',
        ],
        'expected': 'Every attempt is refused with a clear message and nothing is changed.',
    },
    {
        'code': 'UAT-17', 'area': 'Operations', 'role': 'ADMIN', 'priority': 'CRITICAL',
        'title': 'Backup and restore drill',
        'steps': [
            'IT Services runs `manage.py dr_drill --witness "<name>"` on staging.',
            'Confirm the drill appears on the Go-Live page with RPO/RTO within target.',
        ],
        'expected': 'The archive verifies, restores into a scratch database with matching row counts, '
                    'and the drill is recorded as passing.',
    },
]
