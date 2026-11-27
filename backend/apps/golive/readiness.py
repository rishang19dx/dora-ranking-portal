"""
Go-live readiness: every production gate from proposal sections 3.3 and 5.4
evaluated from live evidence, plus the recommendation it adds up to.

The recommendation is advice. The decision itself is a human sign-off
(SignOff GO_NO_GO) that stores a snapshot of this payload.
"""

from datetime import datetime, timezone as dt_timezone
from typing import Optional

from django.conf import settings
from django.db.models import OuterRef, Subquery

from . import backup as backup_lib
from .kpis import pilot_kpis
from .models import (
    Pilot,
    PilotStatus,
    SignOff,
    SignOffDecision,
    SignOffKind,
    TrainingAudience,
    TrainingSession,
    UatExecution,
    UatPriority,
    UatScenario,
    UatStatus,
)

REQUIRED_TRAINING = [TrainingAudience.NODAL_OFFICER, TrainingAudience.ADMIN]


def _gate(key, label, passed, summary, evidence=None, blocking=True):
    return {
        'key': key,
        'label': label,
        'passed': bool(passed),
        'blocking': blocking,
        'summary': summary,
        'evidence': evidence or {},
    }


def security_configuration() -> dict:
    from django.conf import settings as s

    problems = []
    if s.DEBUG:
        problems.append('DEBUG is on')
    if s.SECRET_KEY == getattr(s, 'DEV_SECRET_KEY', None) or s.SECRET_KEY.startswith('django-insecure'):
        problems.append('development SECRET_KEY in use')
    if '*' in s.ALLOWED_HOSTS:
        problems.append("ALLOWED_HOSTS allows '*'")
    if getattr(s, 'CORS_ALLOW_ALL_ORIGINS', False):
        problems.append('CORS allows every origin')
    if not s.DEBUG and not getattr(s, 'SESSION_COOKIE_SECURE', False):
        problems.append('session cookie not marked Secure')
    return _gate(
        'security_configuration', 'Production security configuration', not problems,
        'Production settings are hardened.' if not problems else 'Not production-ready: ' + '; '.join(problems) + '.',
        {'problems': problems},
    )


def backups_current(now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(dt_timezone.utc)
    latest = backup_lib.latest_backup()
    target = settings.DR_TARGET_RPO_HOURS
    if latest is None:
        return _gate('backups', 'Recent verified-format backup', False,
                     'No backup archive found in the backup directory.', {'targetHours': target})
    age_h = (now - latest['createdAt']).total_seconds() / 3600
    ok = age_h <= target and latest['hasChecksum']
    return _gate(
        'backups', 'Recent verified-format backup', ok,
        f"Latest backup {latest['name']} is {age_h:.1f} h old (target <= {target:g} h).",
        {'latest': latest['name'], 'ageHours': round(age_h, 2), 'targetHours': target,
         'count': len(backup_lib.list_backups())},
    )


def uat_progress() -> dict:
    latest_status = UatExecution.objects.filter(scenario=OuterRef('pk')).order_by('-executed_at').values('status')[:1]
    scenarios = list(UatScenario.objects.filter(active=True).annotate(latest=Subquery(latest_status)))
    total = len(scenarios)
    passed = sum(1 for s in scenarios if s.latest == UatStatus.PASS)
    failing = [s.code for s in scenarios if s.latest in (UatStatus.FAIL, UatStatus.BLOCKED)]
    critical_open = [s.code for s in scenarios if s.priority == UatPriority.CRITICAL and s.latest != UatStatus.PASS]
    not_run = [s.code for s in scenarios if s.latest is None]
    ok = total > 0 and passed == total
    return _gate(
        'uat', 'User acceptance testing', ok,
        f'{passed} of {total} scenarios passing; {len(failing)} failing or blocked; {len(not_run)} not yet run.'
        if total else 'No UAT scenarios loaded (run seed_uat_scenarios).',
        {'total': total, 'passed': passed, 'failing': failing, 'criticalOpen': critical_open, 'notRun': not_run},
    )


def latest_signoff(kind: str) -> Optional[SignOff]:
    return SignOff.objects.filter(kind=kind).first()


def uat_signoff() -> dict:
    s = latest_signoff(SignOffKind.UAT)
    ok = s is not None and s.decision == SignOffDecision.APPROVE
    return _gate(
        'uat_signoff', 'DORA UAT sign-off', ok,
        f'Signed by {s.signatory_name} ({s.designation}) on {s.created_at:%d %b %Y}: {s.get_decision_display()}.'
        if s else 'DORA has not yet signed off UAT.',
        {'signoffId': s.id if s else None},
    )


def training_complete() -> dict:
    held = set(TrainingSession.objects.values_list('audience', flat=True))
    missing = [a.label for a in REQUIRED_TRAINING if a.value not in held]
    sessions = TrainingSession.objects.count()
    return _gate(
        'training', 'Staff training', not missing,
        f'{sessions} session(s) held.' + (f' Still required: {", ".join(missing)}.' if missing else ''),
        {'sessions': sessions, 'missingAudiences': missing},
    )


def pilot_completed(pilot: Optional[Pilot]) -> dict:
    if pilot is None:
        return _gate('pilot', 'Controlled pilot', False, 'No pilot has been set up.')
    ok = pilot.status == PilotStatus.COMPLETED
    units = pilot.units.count()
    return _gate(
        'pilot', 'Controlled pilot', ok,
        f'{pilot.name}: {pilot.get_status_display().lower()} with {units} department(s).',
        {'pilotId': pilot.id, 'status': pilot.status, 'units': units},
    )


def current_pilot() -> Optional[Pilot]:
    return Pilot.objects.exclude(status=PilotStatus.PLANNED).first() or Pilot.objects.first()


def readiness(pilot: Optional[Pilot] = None) -> dict:
    pilot = pilot or current_pilot()
    kpi_block = pilot_kpis(pilot)
    gates = [
        pilot_completed(pilot),
        *[_gate(k['key'], f"KPI: {k['label']}", k['passed'], k['summary'], k['evidence']) for k in kpi_block['kpis']],
        uat_progress(),
        uat_signoff(),
        training_complete(),
        backups_current(),
        security_configuration(),
    ]
    blocking_failures = [g['key'] for g in gates if g['blocking'] and not g['passed']]
    go = latest_signoff(SignOffKind.GO_NO_GO)
    handover = latest_signoff(SignOffKind.HANDOVER)

    return {
        'generatedAt': datetime.now(dt_timezone.utc).isoformat(),
        'appVersion': settings.APP_VERSION,
        'pilot': {'id': pilot.id, 'name': pilot.name, 'status': pilot.status} if pilot else None,
        'kpis': kpi_block,
        'gates': gates,
        'recommendation': 'GO' if not blocking_failures else 'NO_GO',
        'blockingFailures': blocking_failures,
        'decision': _signoff_brief(go),
        'handover': _signoff_brief(handover),
    }


def _signoff_brief(s: Optional[SignOff]):
    if s is None:
        return None
    return {
        'id': s.id,
        'decision': s.decision,
        'signatoryName': s.signatory_name,
        'designation': s.designation,
        'at': s.created_at.isoformat(),
    }
