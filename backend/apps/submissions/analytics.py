"""
Department-wise contribution and performance analytics over NIRF submissions.

Phase 1 produced the submission lifecycle; this turns it into the numbers
leadership asks for at review time: which schools and centres are carrying
the data-collection load, who is holding the cycle up, and how clean each
unit's submissions are when they arrive.

Everything here is derived from recorded submissions and their immutable
audit trail - nothing is estimated.
"""

from typing import Any, Dict, List, Optional

from django.db.models import Count, Q

from apps.organogram.models import OrgUnit
from apps.data_requests.models import DataRequest, DataRequestTarget

from .models import (
    FormSchema,
    SectionSubmission,
    SubmissionAuditLog,
    SubmissionStatus,
)

TERMINAL_STATUSES = {SubmissionStatus.APPROVED}


def _pct(part: int, whole: int) -> float:
    if not whole:
        return 0.0
    return round(100.0 * part / whole, 1)


def _turnaround_hours(submission: SectionSubmission) -> Optional[float]:
    if not submission.submitted_at or not submission.reviewed_at:
        return None
    delta = submission.reviewed_at - submission.submitted_at
    return round(delta.total_seconds() / 3600.0, 1)


def compute_department_analytics(
    cycle_year: int,
    request_id: Optional[str] = None,
    category_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Per-unit contribution and performance for a NIRF cycle.

    `category_id` narrows the expected section set to one NIRF category, so
    completion is measured against what that category actually requires.
    """
    submissions = SectionSubmission.objects.select_related('org_unit', 'request')
    if request_id:
        submissions = submissions.filter(request_id=request_id)
    else:
        submissions = submissions.filter(request__cycle_year=cycle_year)

    schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
    schema = schema_obj.content if schema_obj else {}
    section_map = {s['id']: s for s in schema.get('sections', [])}

    # Which sections are expected, and which of those are unit-submitted.
    if category_id:
        cat_def = next(
            (c for c in schema.get('categories', []) if c['id'].upper() == category_id.upper()),
            None,
        )
        expected_section_ids = list(cat_def.get('sections', [])) if cat_def else []
    else:
        expected_section_ids = list(section_map.keys())

    unit_section_ids = [
        sid for sid in expected_section_ids
        if section_map.get(sid, {}).get('ownership', {}).get('submitBy') == 'unit'
    ]
    central_section_ids = [
        sid for sid in expected_section_ids
        if section_map.get(sid, {}).get('ownership', {}).get('submitBy') == 'central'
    ]

    if category_id:
        submissions = submissions.filter(section_id__in=expected_section_ids)

    submission_list = list(submissions)

    # Units that are expected to submit the unit-owned sections.
    eligible_units = list(OrgUnit.objects.filter(kind__in=['SCHOOL', 'CENTRE']))

    # Group submissions by unit.
    by_unit: Dict[str, List[SectionSubmission]] = {}
    for sub in submission_list:
        by_unit.setdefault(sub.org_unit_id, []).append(sub)

    # Correction counts per submission, from the audit trail.
    correction_counts: Dict[str, int] = {}
    if submission_list:
        audit_rows = (
            SubmissionAuditLog.objects
            .filter(submission_id__in=[s.id for s in submission_list], action='REQUEST_CORRECTION')
            .values('submission_id')
            .annotate(n=Count('id'))
        )
        correction_counts = {r['submission_id']: r['n'] for r in audit_rows}

    # Target-level dispatch state, for responsiveness.
    target_rows = DataRequestTarget.objects.select_related('org_unit')
    if request_id:
        target_rows = target_rows.filter(request_id=request_id)
    else:
        target_rows = target_rows.filter(request__cycle_year=cycle_year)
    targets_by_unit: Dict[str, List[DataRequestTarget]] = {}
    for t in target_rows:
        targets_by_unit.setdefault(t.org_unit_id, []).append(t)

    departments: List[Dict[str, Any]] = []
    unit_lookup = {u.id: u for u in eligible_units}
    # Include any unit that submitted even if it is not a school/centre.
    for unit_id in by_unit:
        if unit_id not in unit_lookup:
            found = OrgUnit.objects.filter(id=unit_id).first()
            if found:
                unit_lookup[unit_id] = found

    for unit_id, unit in sorted(unit_lookup.items(), key=lambda kv: kv[1].name):
        subs = by_unit.get(unit_id, [])
        is_academic_unit = unit.kind in ('SCHOOL', 'CENTRE')

        status_counts = {s.value: 0 for s in SubmissionStatus}
        for sub in subs:
            status_counts[sub.status] = status_counts.get(sub.status, 0) + 1

        not_applicable = sum(1 for s in subs if s.not_applicable)
        approved = status_counts.get(SubmissionStatus.APPROVED, 0)
        submitted = status_counts.get(SubmissionStatus.SUBMITTED, 0)
        draft = status_counts.get(SubmissionStatus.DRAFT, 0)
        corrections = status_counts.get(SubmissionStatus.CORRECTION_REQUESTED, 0)

        # Expected set: only unit-owned sections are a department's duty.
        expected = len(unit_section_ids) if is_academic_unit else len(
            {s.section_id for s in subs}
        )
        # Approved already includes approved "not applicable" declarations;
        # an unapproved N/A is not settled.
        settled = approved
        covered_sections = {s.section_id for s in subs}
        missing_sections = (
            [sid for sid in unit_section_ids if sid not in covered_sections]
            if is_academic_unit else []
        )

        turnarounds = [t for t in (_turnaround_hours(s) for s in subs) if t is not None]
        correction_total = sum(correction_counts.get(s.id, 0) for s in subs)

        # Records contributed - the volume of row-level data the unit supplied.
        record_total = sum(s.records.count() for s in subs)

        unit_targets = targets_by_unit.get(unit_id, [])
        reminders = sum(t.reminders_sent for t in unit_targets)

        departments.append({
            'unitId': unit.id,
            'unitName': unit.name,
            'shortName': unit.short_name,
            'kind': unit.kind,
            'type': unit.type,
            'isAcademicUnit': is_academic_unit,
            'expectedSections': expected,
            'sectionsTouched': len(covered_sections),
            'submissions': len(subs),
            'approved': approved,
            'submittedAwaitingReview': submitted,
            'draft': draft,
            'correctionRequested': corrections,
            'notApplicable': not_applicable,
            'completionPct': _pct(settled, expected),
            'missingSections': missing_sections,
            'recordsContributed': record_total,
            'correctionCycles': correction_total,
            # Clean-first-pass rate: submissions approved without a correction loop.
            'firstPassApprovalPct': _pct(
                sum(1 for s in subs if s.status == SubmissionStatus.APPROVED
                    and correction_counts.get(s.id, 0) == 0),
                approved,
            ) if approved else 0.0,
            'avgReviewTurnaroundHours': round(sum(turnarounds) / len(turnarounds), 1) if turnarounds else None,
            'remindersSent': reminders,
        })

    # Institute-level totals.
    total_subs = len(submission_list)
    total_approved = sum(1 for s in submission_list if s.status == SubmissionStatus.APPROVED)
    total_na = sum(1 for s in submission_list if s.not_applicable)
    academic = [d for d in departments if d['isAcademicUnit']]
    expected_total = len(unit_section_ids) * len(eligible_units)

    all_turnarounds = [t for t in (_turnaround_hours(s) for s in submission_list) if t is not None]

    # Section-level bottlenecks: where the cycle is actually stuck.
    section_rollup: List[Dict[str, Any]] = []
    for sid in expected_section_ids:
        sec_subs = [s for s in submission_list if s.section_id == sid]
        sec_def = section_map.get(sid, {})
        submit_by = sec_def.get('ownership', {}).get('submitBy', 'central')
        sec_expected = len(eligible_units) if submit_by == 'unit' else 1
        sec_settled = sum(
            1 for s in sec_subs
            if s.status == SubmissionStatus.APPROVED
        )
        section_rollup.append({
            'sectionId': sid,
            'title': sec_def.get('title', sid),
            'submitBy': submit_by,
            'expected': sec_expected,
            'received': len(sec_subs),
            'settled': sec_settled,
            'awaitingReview': sum(1 for s in sec_subs if s.status == SubmissionStatus.SUBMITTED),
            'inCorrection': sum(1 for s in sec_subs if s.status == SubmissionStatus.CORRECTION_REQUESTED),
            'completionPct': _pct(sec_settled, sec_expected),
        })
    section_rollup.sort(key=lambda r: r['completionPct'])

    return {
        'cycleYear': cycle_year,
        'requestId': request_id,
        'categoryId': category_id,
        'schemaVersion': schema_obj.version if schema_obj else None,
        'institute': {
            'eligibleUnits': len(eligible_units),
            'unitOwnedSections': len(unit_section_ids),
            'centralSections': len(central_section_ids),
            'expectedUnitSubmissions': expected_total,
            'totalSubmissions': total_subs,
            'approved': total_approved,
            'notApplicable': total_na,
            'awaitingReview': sum(1 for s in submission_list if s.status == SubmissionStatus.SUBMITTED),
            'inCorrection': sum(
                1 for s in submission_list if s.status == SubmissionStatus.CORRECTION_REQUESTED
            ),
            'draft': sum(1 for s in submission_list if s.status == SubmissionStatus.DRAFT),
            'overallCompletionPct': _pct(total_approved, expected_total),
            'avgReviewTurnaroundHours': (
                round(sum(all_turnarounds) / len(all_turnarounds), 1) if all_turnarounds else None
            ),
            'unitsFullyComplete': sum(1 for d in academic if d['completionPct'] >= 100.0),
            'unitsNotStarted': sum(1 for d in academic if d['submissions'] == 0),
        },
        'departments': departments,
        'sections': section_rollup,
        'leaderboard': {
            'topContributors': sorted(
                academic, key=lambda d: (-d['recordsContributed'], -d['completionPct'])
            )[:5],
            'laggingUnits': sorted(
                academic, key=lambda d: (d['completionPct'], -len(d['missingSections']))
            )[:5],
        },
    }


# -----------------------------------------------------------------------------
# Substantive department contribution (spec 2.16)
#
# The workflow metrics above answer "is the department keeping up with the
# cycle". Spec 2.16 asks a different question - "which department brought in
# the most research funding or had the highest placement rate" - which has to
# be read out of the submitted values, not the submission status.
# -----------------------------------------------------------------------------

def _grid_rows(payload_block) -> List[Dict[str, Any]]:
    """Normalise a grid block to a list of row dicts, whichever shape it is in."""
    if isinstance(payload_block, dict):
        out = []
        for key, row in payload_block.items():
            if isinstance(row, dict):
                merged = dict(row)
                merged.setdefault('id', key)
                out.append(merged)
        return out
    if isinstance(payload_block, list):
        return [r for r in payload_block if isinstance(r, dict)]
    return []


def _num(value) -> float:
    if isinstance(value, bool) or value is None or value == '':
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _latest_year_key(row: Dict[str, Any]) -> Optional[str]:
    """The most recent year-like column present on a year-axis grid row."""
    years = [k for k in row if str(k)[:4].isdigit()]
    return sorted(years)[-1] if years else None


def compute_department_contributions(
    cycle_year: int,
    request_id: Optional[str] = None,
    unit_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Per-department contribution to the institutional score.

    Reads the unit-owned sections that actually carry scoreable quantities:
    sponsored research money, placement and higher-studies outcomes, Ph.D
    completions and student strength. `unit_ids` scopes the result, which is
    what lets a department head see only their own analytics.
    """
    submissions = SectionSubmission.objects.select_related('org_unit', 'request')
    if request_id:
        submissions = submissions.filter(request_id=request_id)
    else:
        submissions = submissions.filter(request__cycle_year=cycle_year)
    if unit_ids:
        submissions = submissions.filter(org_unit_id__in=unit_ids)

    # Same rule as the export: only checker-approved data counts (spec 2.10),
    # so the dashboard never shows a figure the DCS workbook will not contain.
    submissions = submissions.filter(status=SubmissionStatus.APPROVED).filter(
        section_id__in=[
            'sponsored-project-register',
            'placement-outcomes',
            'phd-details',
            'student-strength',
            'sanctioned-intake',
        ]
    )

    by_unit: Dict[str, Dict[str, Any]] = {}

    def bucket(sub):
        entry = by_unit.setdefault(sub.org_unit_id, {
            'unitId': sub.org_unit_id,
            'unitName': sub.org_unit.name,
            'shortName': sub.org_unit.short_name,
            'kind': sub.org_unit.kind,
            'researchFundingInr': 0.0,
            'sanctionedResearchInr': 0.0,
            'researchProjects': 0,
            'fundingAgencies': set(),
            'graduated': 0.0,
            'placed': 0.0,
            'higherStudies': 0.0,
            'phdGraduated': 0.0,
            'studentStrength': 0.0,
            'femaleStudents': 0.0,
            'sanctionedIntake': 0.0,
            'sections': [],
        })
        entry['sections'].append(sub.section_id)
        return entry

    for sub in submissions:
        if sub.not_applicable:
            continue
        entry = bucket(sub)
        payload = sub.payload if isinstance(sub.payload, dict) else {}

        if sub.section_id == 'sponsored-project-register':
            for rec in sub.records.filter(block_id='projects'):
                data = rec.data if isinstance(rec.data, dict) else {}
                entry['researchFundingInr'] += _num(data.get('receivedFy0'))
                entry['sanctionedResearchInr'] += _num(data.get('sanctionedAmountInr'))
                entry['researchProjects'] += 1
                agency = (data.get('fundingAgency') or '').strip()
                if agency:
                    entry['fundingAgencies'].add(agency)

        elif sub.section_id == 'placement-outcomes':
            for block_id in ('ug', 'pg'):
                for row in _grid_rows(payload.get(block_id)):
                    entry['graduated'] += _num(row.get('graduated'))
                    entry['placed'] += _num(row.get('placed'))
                    entry['higherStudies'] += _num(row.get('higherStudies'))

        elif sub.section_id == 'phd-details':
            for row in _grid_rows(payload.get('graduated')):
                year_key = _latest_year_key(row)
                if year_key:
                    entry['phdGraduated'] += _num(row.get(year_key))

        elif sub.section_id == 'student-strength':
            for row in _grid_rows(payload.get('strength')):
                entry['studentStrength'] += _num(row.get('total'))
                entry['femaleStudents'] += _num(row.get('female'))

        elif sub.section_id == 'sanctioned-intake':
            for row in _grid_rows(payload.get('intake')):
                year_key = _latest_year_key(row)
                if year_key:
                    entry['sanctionedIntake'] += _num(row.get(year_key))

    departments = []
    for entry in by_unit.values():
        graduated = entry['graduated']
        strength = entry['studentStrength']
        departments.append({
            **{k: v for k, v in entry.items() if k != 'fundingAgencies'},
            'fundingAgencies': len(entry['fundingAgencies']),
            'sections': sorted(set(entry['sections'])),
            'placementRatePct': _pct(int(entry['placed']), int(graduated)) if graduated else None,
            'higherStudiesRatePct': _pct(int(entry['higherStudies']), int(graduated)) if graduated else None,
            'outcomeRatePct': (
                _pct(int(entry['placed'] + entry['higherStudies']), int(graduated)) if graduated else None
            ),
            'femaleSharePct': _pct(int(entry['femaleStudents']), int(strength)) if strength else None,
            'fundingPerStudentInr': round(entry['researchFundingInr'] / strength, 2) if strength else None,
        })

    total_funding = sum(d['researchFundingInr'] for d in departments)
    for d in departments:
        d['fundingSharePct'] = _pct(
            int(d['researchFundingInr']), int(total_funding)
        ) if total_funding else None

    def top_by(field, require=None):
        pool = [d for d in departments if d.get(field) is not None]
        if require:
            pool = [d for d in pool if d.get(require)]
        if not pool:
            return None
        best = max(pool, key=lambda d: d[field])
        return {
            'unitId': best['unitId'],
            'unitName': best['unitName'],
            'shortName': best['shortName'],
            'value': best[field],
        }

    return {
        'cycleYear': cycle_year,
        'requestId': request_id,
        'scopedToUnits': unit_ids or None,
        'departments': sorted(departments, key=lambda d: -d['researchFundingInr']),
        'institute': {
            'departmentsReporting': len(departments),
            'totalResearchFundingInr': round(total_funding, 2),
            'totalResearchProjects': sum(d['researchProjects'] for d in departments),
            'totalGraduated': int(sum(d['graduated'] for d in departments)),
            'totalPlaced': int(sum(d['placed'] for d in departments)),
            'totalHigherStudies': int(sum(d['higherStudies'] for d in departments)),
            'totalPhdGraduated': int(sum(d['phdGraduated'] for d in departments)),
            'totalStudentStrength': int(sum(d['studentStrength'] for d in departments)),
            'institutePlacementRatePct': _pct(
                int(sum(d['placed'] for d in departments)),
                int(sum(d['graduated'] for d in departments)),
            ) if sum(d['graduated'] for d in departments) else None,
        },
        'leaders': {
            'mostResearchFunding': top_by('researchFundingInr'),
            'highestPlacementRate': top_by('placementRatePct'),
            'highestOutcomeRate': top_by('outcomeRatePct'),
            'mostPhdGraduated': top_by('phdGraduated'),
            'mostFundingPerStudent': top_by('fundingPerStudentInr'),
        },
    }
