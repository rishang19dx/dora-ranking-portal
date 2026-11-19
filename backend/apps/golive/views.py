"""
Go-live API (Phase 4): readiness, pilot + KPI evidence, UAT, DR drills,
backups, training and sign-offs.

Reads are open to Admin, Director and Auditor; writes to Admin and Director.
Every write is also recorded in the platform audit trail.
"""

from django.db import connection
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrDirectorOrAuditorReadOnly
from apps.data_requests.models import DataRequest
from apps.organogram.models import OrgUnit
from apps.submissions.cross_checks import run_cross_checks

from . import audit
from . import backup as backup_lib
from .kpis import pilot_kpis
from .models import (
    DisasterRecoveryDrill,
    DrillKind,
    FlagReview,
    FlagVerdict,
    Pilot,
    PilotStatus,
    SignOff,
    SignOffDecision,
    SignOffKind,
    TrainingAudience,
    TrainingSession,
    UatExecution,
    UatScenario,
    UatStatus,
)
from .readiness import readiness


def _err(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def _user_name(user):
    if user is None:
        return None
    return user.get_full_name() or user.username


# ---------------------------------------------------------------------------
# Health (unauthenticated; used by Docker, the load balancer and monitoring)
# ---------------------------------------------------------------------------

class HealthView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            db_ok = True
        except Exception:  # noqa: BLE001 - any DB failure means unhealthy
            db_ok = False
        from django.conf import settings
        body = {
            'status': 'ok' if db_ok else 'degraded',
            'database': 'ok' if db_ok else 'unavailable',
            'version': settings.APP_VERSION,
            'time': timezone.now().isoformat(),
        }
        return Response(body, status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE)


# ---------------------------------------------------------------------------
# Readiness
# ---------------------------------------------------------------------------

class ReadinessView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        pilot = None
        if request.query_params.get('pilot'):
            pilot = get_object_or_404(Pilot, pk=request.query_params['pilot'])
        return Response(readiness(pilot))


# ---------------------------------------------------------------------------
# Pilot
# ---------------------------------------------------------------------------

def pilot_dict(p: Pilot, with_kpis=False):
    data = {
        'id': p.id,
        'name': p.name,
        'cycleYear': p.cycle_year,
        'status': p.status,
        'units': [{'id': u.id, 'name': u.name} for u in p.units.all()],
        'requests': [{'id': r.id, 'reference': r.reference, 'title': r.title} for r in p.requests.all()],
        'startedAt': p.started_at.isoformat() if p.started_at else None,
        'endedAt': p.ended_at.isoformat() if p.ended_at else None,
        'notes': p.notes,
        'createdAt': p.created_at.isoformat(),
    }
    if with_kpis:
        data['kpis'] = pilot_kpis(p)
    return data


PILOT_TRANSITIONS = {
    PilotStatus.PLANNED: {PilotStatus.RUNNING},
    PilotStatus.RUNNING: {PilotStatus.COMPLETED},
    PilotStatus.COMPLETED: set(),
}


def _apply_scope(pilot, data):
    if 'unitIds' in data:
        ids = list(data.get('unitIds') or [])
        units = list(OrgUnit.objects.filter(id__in=ids))
        if len(units) != len(set(ids)):
            raise ValueError('One or more unitIds do not exist.')
        pilot.units.set(units)
    if 'requestIds' in data:
        ids = list(data.get('requestIds') or [])
        reqs = list(DataRequest.objects.filter(id__in=ids))
        if len(reqs) != len(set(ids)):
            raise ValueError('One or more requestIds do not exist.')
        pilot.requests.set(reqs)


class PilotListView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        pilots = Pilot.objects.prefetch_related('units', 'requests')
        return Response([pilot_dict(p) for p in pilots])

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        try:
            cycle_year = int(request.data.get('cycleYear'))
        except (TypeError, ValueError):
            return _err("'cycleYear' is required and must be a year.")
        if not name:
            return _err("'name' is required.")
        pilot = Pilot.objects.create(
            name=name, cycle_year=cycle_year, notes=request.data.get('notes') or '', created_by=request.user,
        )
        try:
            _apply_scope(pilot, request.data)
        except ValueError as exc:
            pilot.delete()
            return _err(str(exc))
        audit.record('PILOT_CREATE', user=request.user, delta={'pilotId': pilot.id, 'name': name})
        return Response(pilot_dict(pilot), status=status.HTTP_201_CREATED)


class PilotDetailView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request, pk):
        return Response(pilot_dict(get_object_or_404(Pilot, pk=pk), with_kpis=True))

    def patch(self, request, pk):
        pilot = get_object_or_404(Pilot, pk=pk)
        before = pilot.status
        new_status = request.data.get('status')
        if new_status and new_status != pilot.status:
            if new_status not in PILOT_TRANSITIONS.get(pilot.status, set()):
                return _err(f"Cannot move a pilot from {pilot.status} to {new_status}.", status.HTTP_409_CONFLICT)
            pilot.status = new_status
            if new_status == PilotStatus.RUNNING:
                pilot.started_at = timezone.now()
            if new_status == PilotStatus.COMPLETED:
                pilot.ended_at = timezone.now()
        if pilot.status == PilotStatus.COMPLETED and before == PilotStatus.COMPLETED and (
            'unitIds' in request.data or 'requestIds' in request.data
        ):
            return _err('A completed pilot\'s scope is frozen.', status.HTTP_409_CONFLICT)
        for field, attr in (('name', 'name'), ('notes', 'notes')):
            if field in request.data:
                setattr(pilot, attr, request.data.get(field) or '')
        pilot.save()
        try:
            _apply_scope(pilot, request.data)
        except ValueError as exc:
            return _err(str(exc))
        audit.record('PILOT_UPDATE', user=request.user, delta={
            'pilotId': pilot.id, 'fromStatus': before, 'toStatus': pilot.status,
        })
        return Response(pilot_dict(pilot, with_kpis=True))


# ---------------------------------------------------------------------------
# Flag reviews (ground truth for the AI-reliability KPI)
# ---------------------------------------------------------------------------

def flag_dict(f: FlagReview):
    return {
        'id': f.id,
        'pilotId': f.pilot_id,
        'requestId': f.request_id,
        'requestReference': f.request.reference,
        'checkId': f.check_id,
        'severity': f.severity,
        'critical': f.critical,
        'systemFlagged': f.system_flagged,
        'message': f.message,
        'verdict': f.verdict,
        'comment': f.comment,
        'reviewer': _user_name(f.reviewer),
        'reviewedAt': f.reviewed_at.isoformat() if f.reviewed_at else None,
    }


class PilotFlagReviewsView(APIView):
    """
    GET  the pilot's reviewed checks.
    POST {requestId} runs the automated cross-checks for that request now and
         queues each result for a reviewer verdict. Re-syncing refreshes the
         system's answer; a changed answer resets the verdict to PENDING.
    """
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request, pk):
        pilot = get_object_or_404(Pilot, pk=pk)
        reviews = pilot.flag_reviews.select_related('request', 'reviewer')
        return Response([flag_dict(f) for f in reviews])

    def post(self, request, pk):
        pilot = get_object_or_404(Pilot, pk=pk)
        if pilot.status == PilotStatus.COMPLETED:
            return _err('The pilot is completed; its evidence is frozen.', status.HTTP_409_CONFLICT)
        req = get_object_or_404(DataRequest, pk=request.data.get('requestId'))
        if not pilot.requests.filter(pk=req.pk).exists():
            pilot.requests.add(req)

        created = updated = 0
        for result in run_cross_checks(req.id, req.cycle_year):
            flagged = not result.get('passed', True)
            severity = result.get('severity', 'info')
            review, was_created = FlagReview.objects.get_or_create(
                pilot=pilot, request=req, check_id=result['id'],
                defaults={
                    'severity': severity,
                    'critical': severity == 'error',
                    'system_flagged': flagged,
                    'message': result.get('message', ''),
                },
            )
            if was_created:
                created += 1
            elif review.system_flagged != flagged or review.message != result.get('message', ''):
                if review.system_flagged != flagged:
                    review.verdict = FlagVerdict.PENDING
                    review.reviewer = None
                    review.reviewed_at = None
                review.system_flagged = flagged
                review.severity = severity
                review.critical = severity == 'error'
                review.message = result.get('message', '')
                review.save()
                updated += 1

        reviews = pilot.flag_reviews.select_related('request', 'reviewer')
        return Response({'created': created, 'updated': updated, 'reviews': [flag_dict(f) for f in reviews]})


class FlagReviewDetailView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def patch(self, request, pk):
        review = get_object_or_404(FlagReview.objects.select_related('pilot', 'request'), pk=pk)
        if review.pilot.status == PilotStatus.COMPLETED:
            return _err('The pilot is completed; its evidence is frozen.', status.HTTP_409_CONFLICT)
        verdict = request.data.get('verdict')
        if verdict not in (FlagVerdict.AGREE, FlagVerdict.DISAGREE):
            return _err("'verdict' must be AGREE or DISAGREE.")
        comment = (request.data.get('comment') or '').strip()
        if verdict == FlagVerdict.DISAGREE and not comment:
            return _err('Explain why the system was wrong when disagreeing.')
        review.verdict = verdict
        review.comment = comment
        review.reviewer = request.user
        review.reviewed_at = timezone.now()
        review.save()
        audit.record('FLAG_REVIEW', user=request.user, delta={
            'flagReviewId': review.id, 'checkId': review.check_id, 'requestId': review.request_id,
            'systemFlagged': review.system_flagged, 'verdict': verdict, 'comment': comment,
        })
        return Response(flag_dict(review))


# ---------------------------------------------------------------------------
# UAT
# ---------------------------------------------------------------------------

def execution_dict(e: UatExecution):
    return {
        'id': e.id,
        'status': e.status,
        'testerName': e.tester_name,
        'notes': e.notes,
        'defectRef': e.defect_ref,
        'executedAt': e.executed_at.isoformat(),
    }


class UatScenarioListView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        scenarios = UatScenario.objects.filter(active=True).prefetch_related('executions')
        out = []
        for s in scenarios:
            history = list(s.executions.all())  # ordered newest first
            out.append({
                'code': s.code,
                'title': s.title,
                'area': s.area,
                'role': s.role,
                'priority': s.priority,
                'steps': s.steps,
                'expected': s.expected,
                'latest': execution_dict(history[0]) if history else None,
                'history': [execution_dict(e) for e in history[:10]],
            })
        return Response(out)


class UatExecutionCreateView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def post(self, request, code):
        scenario = get_object_or_404(UatScenario, code=code, active=True)
        result = request.data.get('status')
        if result not in UatStatus.values:
            return _err(f"'status' must be one of {', '.join(UatStatus.values)}.")
        tester = (request.data.get('testerName') or '').strip() or _user_name(request.user)
        notes = (request.data.get('notes') or '').strip()
        if result != UatStatus.PASS and not notes:
            return _err('Describe what went wrong for a failed or blocked scenario.')
        execution = UatExecution.objects.create(
            scenario=scenario, status=result, tester_name=tester, tester=request.user,
            notes=notes, defect_ref=(request.data.get('defectRef') or '').strip(),
        )
        audit.record('UAT_RESULT', user=request.user, delta={
            'scenario': code, 'status': result, 'tester': tester, 'defectRef': execution.defect_ref,
        })
        return Response(execution_dict(execution), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# DR drills and backups
# ---------------------------------------------------------------------------

def drill_dict(d: DisasterRecoveryDrill):
    return {
        'id': d.id,
        'kind': d.kind,
        'backupName': d.backup_name,
        'backupCreatedAt': d.backup_created_at.isoformat(),
        'failureDeclaredAt': d.failure_declared_at.isoformat(),
        'restoredAt': d.restored_at.isoformat(),
        'rpoHours': round(d.rpo_hours, 3),
        'rtoHours': round(d.rto_hours, 3),
        'integrityOk': d.integrity_ok,
        'meetsTargets': d.meets_targets,
        'witnessedBy': d.witnessed_by,
        'notes': d.notes,
    }


def _parse_dt(value, name):
    dt = parse_datetime(value) if isinstance(value, str) else None
    if dt is None:
        raise ValueError(f"'{name}' must be an ISO date-time.")
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


class DrillListView(APIView):
    """
    GET the drill history. POST records a manual (e.g. full-stack, on the
    production host) drill run by IT Services with a named witness; automated
    scratch-database drills are recorded by `manage.py dr_drill`.
    """
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        return Response([drill_dict(d) for d in DisasterRecoveryDrill.objects.all()[:50]])

    def post(self, request):
        data = request.data
        witness = (data.get('witnessedBy') or '').strip()
        if not witness:
            return _err("'witnessedBy' is required for a manually recorded drill.")
        try:
            backup_at = _parse_dt(data.get('backupCreatedAt'), 'backupCreatedAt')
            declared = _parse_dt(data.get('failureDeclaredAt'), 'failureDeclaredAt')
            restored = _parse_dt(data.get('restoredAt'), 'restoredAt')
        except ValueError as exc:
            return _err(str(exc))
        if not (backup_at <= declared <= restored):
            return _err('Times must satisfy backup <= failure declared <= restored.')
        drill = DisasterRecoveryDrill.objects.create(
            kind=DrillKind.WITNESSED,
            backup_name=(data.get('backupName') or '').strip() or 'manual',
            backup_created_at=backup_at,
            failure_declared_at=declared,
            restored_at=restored,
            integrity_ok=bool(data.get('integrityOk')),
            witnessed_by=witness,
            notes=data.get('notes') or '',
            details={'source': 'manual'},
            recorded_by=request.user,
        )
        audit.record('DR_DRILL', user=request.user, delta={
            'drillId': drill.id, 'rpoHours': round(drill.rpo_hours, 3), 'rtoHours': round(drill.rto_hours, 3),
            'integrityOk': drill.integrity_ok, 'witnessedBy': witness,
        })
        return Response(drill_dict(drill), status=status.HTTP_201_CREATED)


class BackupListView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        rows = backup_lib.list_backups()
        return Response([
            {'name': r['name'], 'createdAt': r['createdAt'].isoformat(), 'size': r['size'],
             'hasChecksum': r['hasChecksum']}
            for r in rows
        ])

    def post(self, request):
        """On-demand backup, e.g. right before a release."""
        try:
            path = backup_lib.create_backup(label=(request.data.get('label') or 'manual'))
        except backup_lib.BackupError as exc:
            return _err(str(exc), status.HTTP_409_CONFLICT)
        check = backup_lib.verify_backup(path)
        removed = backup_lib.prune_backups()
        audit.record('BACKUP', user=request.user, delta={
            'archive': path.name, 'rows': sum(check.counts.values()), 'files': check.files, 'pruned': removed,
        })
        return Response({'name': path.name, 'verified': check.ok, 'rows': sum(check.counts.values()),
                         'files': check.files}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def training_dict(t: TrainingSession):
    return {
        'id': t.id,
        'title': t.title,
        'audience': t.audience,
        'heldOn': t.held_on.isoformat(),
        'trainer': t.trainer,
        'attendees': t.attendees,
        'units': [{'id': u.id, 'name': u.name} for u in t.units.all()],
        'materials': t.materials,
        'notes': t.notes,
    }


class TrainingListView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        return Response([training_dict(t) for t in TrainingSession.objects.prefetch_related('units')])

    def post(self, request):
        data = request.data
        title = (data.get('title') or '').strip()
        trainer = (data.get('trainer') or '').strip()
        audience = data.get('audience')
        held_on = parse_date(data.get('heldOn') or '')
        if not title or not trainer:
            return _err("'title' and 'trainer' are required.")
        if audience not in TrainingAudience.values:
            return _err(f"'audience' must be one of {', '.join(TrainingAudience.values)}.")
        if held_on is None:
            return _err("'heldOn' must be a date (YYYY-MM-DD).")
        try:
            attendees = int(data.get('attendees') or 0)
            if attendees < 0:
                raise ValueError
        except (TypeError, ValueError):
            return _err("'attendees' must be a non-negative number.")
        session = TrainingSession.objects.create(
            title=title, audience=audience, held_on=held_on, trainer=trainer, attendees=attendees,
            materials=data.get('materials') or '', notes=data.get('notes') or '', recorded_by=request.user,
        )
        unit_ids = data.get('unitIds') or []
        if unit_ids:
            session.units.set(OrgUnit.objects.filter(id__in=unit_ids))
        audit.record('TRAINING', user=request.user, delta={
            'trainingId': session.id, 'audience': audience, 'heldOn': held_on.isoformat(), 'attendees': attendees,
        })
        return Response(training_dict(session), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Sign-offs
# ---------------------------------------------------------------------------

def signoff_dict(s: SignOff, with_snapshot=False):
    data = {
        'id': s.id,
        'kind': s.kind,
        'decision': s.decision,
        'pilotId': s.pilot_id,
        'signatoryName': s.signatory_name,
        'designation': s.designation,
        'comment': s.comment,
        'recommendationAtSigning': (s.readiness_snapshot or {}).get('recommendation'),
        'createdAt': s.created_at.isoformat(),
    }
    if with_snapshot:
        data['readinessSnapshot'] = s.readiness_snapshot
    return data


class SignOffListView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        with_snapshot = request.query_params.get('snapshot') == '1'
        return Response([signoff_dict(s, with_snapshot) for s in SignOff.objects.all()[:100]])

    def post(self, request):
        data = request.data
        kind = data.get('kind')
        decision = data.get('decision')
        name = (data.get('signatoryName') or '').strip()
        designation = (data.get('designation') or '').strip()
        comment = (data.get('comment') or '').strip()
        if kind not in SignOffKind.values:
            return _err(f"'kind' must be one of {', '.join(SignOffKind.values)}.")
        if decision not in SignOffDecision.values:
            return _err("'decision' must be APPROVE or REJECT.")
        if not name or not designation:
            return _err("'signatoryName' and 'designation' are required.")

        pilot = None
        if data.get('pilotId'):
            pilot = get_object_or_404(Pilot, pk=data['pilotId'])
        snapshot = readiness(pilot)

        # A "go" against a NO_GO recommendation is allowed (the decision is
        # DORA's), but only with a written justification on record.
        if kind == SignOffKind.GO_NO_GO and decision == SignOffDecision.APPROVE \
                and snapshot['recommendation'] != 'GO' and not comment:
            return _err('The readiness gates recommend NO_GO. A written justification is required to approve.')
        if decision == SignOffDecision.REJECT and not comment:
            return _err('Give the reason for rejecting.')

        signoff = SignOff.objects.create(
            kind=kind, decision=decision, pilot=pilot or (
                Pilot.objects.filter(pk=(snapshot.get('pilot') or {}).get('id')).first()
            ),
            signatory_name=name, designation=designation, comment=comment,
            readiness_snapshot=snapshot, signed_by=request.user,
        )
        audit.record('SIGNOFF', user=request.user, delta={
            'signoffId': signoff.id, 'kind': kind, 'decision': decision, 'signatory': name,
            'designation': designation, 'recommendation': snapshot['recommendation'], 'comment': comment,
        })
        return Response(signoff_dict(signoff, with_snapshot=True), status=status.HTTP_201_CREATED)

