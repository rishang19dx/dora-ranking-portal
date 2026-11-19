"""
The three measurable pilot KPIs (proposal section 3.3).

* AI reliability     > 95% accuracy flagging discrepancies, and zero false
                       positives on critical metrics. Ground truth comes from
                       reviewer verdicts on each automated check (FlagReview).
* Data auditability  100% of data modifications tied to a recorded actor and
                       timestamp in the immutable audit log. Measured from both
                       directions: every audit row must name a resolvable actor,
                       and every modification visible in submission state
                       (edits, submissions, reviews) must have its audit row.
* System resilience  A witnessed DR drill confirming the 24 h RPO and 8 h RTO.

Each function returns a plain dict with `passed`, `value`, `target` and the
evidence behind the number, so the same payload serves the readiness page,
the go/no-go snapshot and the pilot report.
"""

from typing import Optional

from django.conf import settings
from django.contrib.auth import get_user_model

from apps.organogram.models import NodalOfficer
from apps.submissions.models import SectionSubmission, SubmissionAuditLog

from .models import DisasterRecoveryDrill, DrillKind, FlagReview, FlagVerdict, Pilot

REVIEW_ACTIONS = {'APPROVE', 'REJECT', 'REQUEST_CORRECTION'}
EDIT_ACTIONS = {'UPDATE', 'IMPORT'}


def flag_reliability(pilot: Optional[Pilot] = None) -> dict:
    qs = FlagReview.objects.all()
    if pilot is not None:
        qs = qs.filter(pilot=pilot)

    reviewed = qs.exclude(verdict=FlagVerdict.PENDING)
    tp = reviewed.filter(system_flagged=True, verdict=FlagVerdict.AGREE).count()
    fp = reviewed.filter(system_flagged=True, verdict=FlagVerdict.DISAGREE).count()
    tn = reviewed.filter(system_flagged=False, verdict=FlagVerdict.AGREE).count()
    fn = reviewed.filter(system_flagged=False, verdict=FlagVerdict.DISAGREE).count()
    critical_fp = reviewed.filter(system_flagged=True, verdict=FlagVerdict.DISAGREE, critical=True).count()
    critical_flags = reviewed.filter(system_flagged=True, critical=True).count()
    total = tp + fp + tn + fn
    pending = qs.filter(verdict=FlagVerdict.PENDING).count()

    accuracy = (tp + tn) / total if total else None
    target = settings.KPI_FLAG_ACCURACY_TARGET
    passed = bool(total) and pending == 0 and accuracy > target and critical_fp == 0

    if not total:
        summary = 'No reviewed checks yet. Sync the pilot requests and record reviewer verdicts.'
    elif pending:
        summary = f'{pending} check(s) still awaiting a reviewer verdict.'
    else:
        summary = f'{accuracy:.1%} accuracy over {total} reviewed checks; {critical_fp} critical false positive(s).'

    return {
        'key': 'ai_reliability',
        'label': 'AI reliability',
        'passed': passed,
        'value': accuracy,
        'target': target,
        'summary': summary,
        'evidence': {
            'truePositives': tp,
            'falsePositives': fp,
            'trueNegatives': tn,
            'falseNegatives': fn,
            'reviewed': total,
            'pending': pending,
            'criticalFlags': critical_flags,
            'criticalFalsePositives': critical_fp,
            'precision': tp / (tp + fp) if (tp + fp) else None,
            'recall': tp / (tp + fn) if (tp + fn) else None,
        },
    }


def _scope_submissions(pilot: Optional[Pilot]):
    qs = SectionSubmission.objects.all()
    if pilot is None:
        return qs
    request_ids = list(pilot.requests.values_list('id', flat=True))
    unit_ids = list(pilot.units.values_list('id', flat=True))
    if request_ids:
        qs = qs.filter(request_id__in=request_ids)
    else:
        qs = qs.filter(request__cycle_year=pilot.cycle_year)
    if unit_ids:
        qs = qs.filter(org_unit_id__in=unit_ids)
    return qs


def data_auditability(pilot: Optional[Pilot] = None) -> dict:
    submissions = list(_scope_submissions(pilot).only(
        'id', 'revision', 'payload', 'submitted_at', 'reviewed_at', 'status',
    ))
    sub_ids = [s.id for s in submissions]
    logs = list(SubmissionAuditLog.objects.filter(submission_id__in=sub_ids).only(
        'id', 'submission_id', 'actor_type', 'actor_id', 'action', 'timestamp',
    ))

    officer_ids = set(NodalOfficer.objects.filter(
        id__in={log.actor_id for log in logs if log.actor_type == 'OFFICER'}
    ).values_list('id', flat=True))
    user_ids = {str(pk) for pk in get_user_model().objects.filter(
        id__in=[a for a in {log.actor_id for log in logs if log.actor_type == 'ADMIN'} if str(a).isdigit()]
    ).values_list('id', flat=True)}

    def actor_known(log):
        if not log.actor_id or not log.timestamp:
            return False
        if log.actor_type == 'OFFICER':
            return log.actor_id in officer_ids
        if log.actor_type == 'ADMIN':
            return str(log.actor_id) in user_ids
        return log.actor_type == 'SYSTEM'

    untraced_rows = [log.id for log in logs if not actor_known(log)]

    actions_by_sub = {}
    for log in logs:
        actions_by_sub.setdefault(log.submission_id, set()).add(log.action)

    # Modifications implied by each submission's own state.
    expected = 0
    gaps = []
    for sub in submissions:
        seen = actions_by_sub.get(sub.id, set())
        checks = []
        if sub.payload or sub.revision > 1:
            checks.append(('edit', bool(seen & (EDIT_ACTIONS | {'SUBMIT'}))))
        if sub.submitted_at:
            checks.append(('submit', 'SUBMIT' in seen))
        if sub.reviewed_at:
            checks.append(('review', bool(seen & REVIEW_ACTIONS)))
        for kind, ok in checks:
            expected += 1
            if not ok:
                gaps.append({'submissionId': sub.id, 'missing': kind})

    events = len(logs) + expected
    traced = (len(logs) - len(untraced_rows)) + (expected - len(gaps))
    value = traced / events if events else None
    passed = bool(events) and not untraced_rows and not gaps

    if not events:
        summary = 'No modifications recorded in scope yet.'
    else:
        summary = (f'{traced} of {events} modification events traced to an actor and timestamp '
                   f'({len(untraced_rows)} unresolved audit rows, {len(gaps)} unlogged changes).')

    return {
        'key': 'data_auditability',
        'label': 'Data auditability',
        'passed': passed,
        'value': value,
        'target': 1.0,
        'summary': summary,
        'evidence': {
            'submissionsInScope': len(submissions),
            'auditRows': len(logs),
            'stateTransitionsChecked': expected,
            'untracedAuditRows': untraced_rows[:50],
            'unloggedChanges': gaps[:50],
        },
    }


def system_resilience() -> dict:
    witnessed = DisasterRecoveryDrill.objects.filter(kind=DrillKind.WITNESSED).exclude(witnessed_by='')
    latest = witnessed.first()
    latest_auto = DisasterRecoveryDrill.objects.filter(kind=DrillKind.AUTOMATED).first()
    rpo_target = settings.DR_TARGET_RPO_HOURS
    rto_target = settings.DR_TARGET_RTO_HOURS

    def drill_dict(d):
        if d is None:
            return None
        return {
            'id': d.id,
            'kind': d.kind,
            'at': d.failure_declared_at.isoformat(),
            'rpoHours': round(d.rpo_hours, 3),
            'rtoHours': round(d.rto_hours, 3),
            'integrityOk': d.integrity_ok,
            'meetsTargets': d.meets_targets,
            'witnessedBy': d.witnessed_by,
        }

    passed = bool(latest and latest.meets_targets)
    if latest is None:
        summary = 'No witnessed DR drill recorded yet.'
    else:
        summary = (f'Latest witnessed drill: RPO {latest.rpo_hours:.2f} h (target {rpo_target:g} h), '
                   f'RTO {latest.rto_hours:.2f} h (target {rto_target:g} h), '
                   f'integrity {"verified" if latest.integrity_ok else "FAILED"}.')

    return {
        'key': 'system_resilience',
        'label': 'System resilience',
        'passed': passed,
        'value': None,
        'target': {'rpoHours': rpo_target, 'rtoHours': rto_target},
        'summary': summary,
        'evidence': {'latestWitnessed': drill_dict(latest), 'latestAutomated': drill_dict(latest_auto)},
    }


def pilot_kpis(pilot: Optional[Pilot] = None) -> dict:
    items = [flag_reliability(pilot), data_auditability(pilot), system_resilience()]
    return {
        'pilotId': pilot.id if pilot else None,
        'allPassed': all(k['passed'] for k in items),
        'kpis': items,
    }

