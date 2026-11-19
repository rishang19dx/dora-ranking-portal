"""
Phase 4 - UAT, handover and production readiness.

Covers the production security gate, health check, login throttling, the
controlled pilot and its three KPIs, UAT recording, sign-offs, backups
(create / verify / tamper detection / restore) and the DR drill.
"""

import json
import os
import subprocess
import sys
import tarfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.golive import backup as backup_lib
from apps.golive.drill import run_drill
from apps.golive.kpis import data_auditability, flag_reliability, system_resilience
from apps.golive.models import (
    DisasterRecoveryDrill,
    DrillKind,
    FlagReview,
    FlagVerdict,
    Pilot,
    PilotStatus,
    SignOff,
    UatScenario,
)
from apps.submissions.models import SectionSubmission, SubmissionAuditLog, SubmissionStatus

BACKEND_DIR = Path(__file__).resolve().parent.parent


def client_for(role, username=None):
    username = username or f'{role.lower()}_p4'
    User.objects.create_user(username=username, password='Phase4Pass!23', role=role)
    client = APIClient()
    token = client.post('/api/auth/token/', {'username': username, 'password': 'Phase4Pass!23'},
                        format='json').data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


@pytest.fixture
def director_client(db):
    return client_for(UserRole.DIRECTOR)


@pytest.fixture
def auditor_client(db):
    return client_for(UserRole.AUDITOR)


@pytest.fixture
def backup_env(settings, tmp_path):
    settings.BACKUP_DIR = tmp_path / 'backups'
    settings.MEDIA_ROOT = tmp_path / 'media'
    (tmp_path / 'media' / 'proofs').mkdir(parents=True)
    (tmp_path / 'media' / 'proofs' / 'grant.pdf').write_bytes(b'%PDF-1.4 sanction letter')
    return tmp_path


@pytest.fixture
def pilot(db, sample_org_unit, sample_data_request):
    p = Pilot.objects.create(name='NIRF 2027 pilot', cycle_year=sample_data_request.cycle_year)
    p.units.add(sample_org_unit)
    p.requests.add(sample_data_request)
    return p


# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------

class TestProductionSecurityGate:
    def _import_settings(self, **env):
        full_env = {**os.environ, **env}
        full_env.pop('DATABASE_URL', None)
        return subprocess.run(
            [sys.executable, '-c', 'import dora_backend.settings'],
            cwd=BACKEND_DIR, env=full_env, capture_output=True, text=True, timeout=60,
        )

    def test_refuses_dev_secret_key_in_production(self):
        result = self._import_settings(DJANGO_DEBUG='False', DJANGO_SECRET_KEY='')
        assert result.returncode != 0
        assert 'DJANGO_SECRET_KEY' in result.stderr

    def test_refuses_short_secret_key_in_production(self):
        result = self._import_settings(DJANGO_DEBUG='False', DJANGO_SECRET_KEY='short-key')
        assert result.returncode != 0

    def test_accepts_strong_key_and_hardens_transport(self):
        code = ('import dora_backend.settings as s; '
                'print(s.ALLOWED_HOSTS, s.SECURE_SSL_REDIRECT, s.SESSION_COOKIE_SECURE, s.CORS_ALLOW_ALL_ORIGINS)')
        full_env = {**os.environ, 'DJANGO_DEBUG': 'False', 'DJANGO_SECRET_KEY': 'k' * 64,
                    'DJANGO_ALLOWED_HOSTS': 'arp.iitmandi.ac.in'}
        result = subprocess.run([sys.executable, '-c', code], cwd=BACKEND_DIR, env=full_env,
                                capture_output=True, text=True, timeout=60)
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['arp.iitmandi.ac.in'] True True False"


@pytest.mark.django_db
class TestLoginThrottle:
    def test_repeated_failed_logins_are_throttled(self, settings):
        client = APIClient()
        codes = [
            client.post('/api/auth/token/', {'username': 'x', 'password': 'wrong'}, format='json').status_code
            for _ in range(11)
        ]
        assert codes[:10] == [401] * 10
        assert codes[10] == 429


@pytest.mark.django_db
class TestHealth:
    def test_health_is_public_and_reports_database(self, api_client):
        res = api_client.get('/api/health/')
        assert res.status_code == 200
        assert res.data['status'] == 'ok'
        assert res.data['database'] == 'ok'


# ---------------------------------------------------------------------------
# Access control on the go-live API
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGoLiveAccess:
    def test_anonymous_and_nodal_officer_are_refused(self, api_client, auth_client):
        assert api_client.get('/api/golive/readiness/').status_code in (401, 403)
        assert auth_client.get('/api/golive/readiness/').status_code == 403

    def test_auditor_reads_but_cannot_write(self, auditor_client):
        assert auditor_client.get('/api/golive/readiness/').status_code == 200
        res = auditor_client.post('/api/golive/pilots/', {'name': 'x', 'cycleYear': 2027}, format='json')
        assert res.status_code == 403

    def test_readiness_payload_shape(self, admin_client):
        data = admin_client.get('/api/golive/readiness/').data
        keys = {g['key'] for g in data['gates']}
        assert {'pilot', 'ai_reliability', 'data_auditability', 'system_resilience', 'uat',
                'uat_signoff', 'training', 'backups', 'security_configuration'} <= keys
        # Development settings (DEBUG on) must never read as production-ready.
        assert data['recommendation'] == 'NO_GO'
        assert 'security_configuration' in data['blockingFailures']


# ---------------------------------------------------------------------------
# Pilot lifecycle and AI-reliability KPI
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestPilot:
    def test_create_and_lifecycle(self, admin_client, sample_org_unit, sample_data_request):
        res = admin_client.post('/api/golive/pilots/', {
            'name': 'Pilot', 'cycleYear': 2027, 'unitIds': [sample_org_unit.id],
            'requestIds': [sample_data_request.id],
        }, format='json')
        assert res.status_code == 201
        pid = res.data['id']
        assert res.data['units'][0]['id'] == sample_org_unit.id

        assert admin_client.patch(f'/api/golive/pilots/{pid}/', {'status': 'COMPLETED'},
                                  format='json').status_code == 409
        res = admin_client.patch(f'/api/golive/pilots/{pid}/', {'status': 'RUNNING'}, format='json')
        assert res.status_code == 200 and res.data['startedAt']
        res = admin_client.patch(f'/api/golive/pilots/{pid}/', {'status': 'COMPLETED'}, format='json')
        assert res.data['status'] == 'COMPLETED' and res.data['endedAt']
        assert SubmissionAuditLog.objects.filter(action='PILOT_UPDATE').count() == 2

    def test_unknown_unit_rejected(self, admin_client):
        res = admin_client.post('/api/golive/pilots/', {'name': 'P', 'cycleYear': 2027, 'unitIds': ['nope']},
                                format='json')
        assert res.status_code == 400
        assert not Pilot.objects.exists()

    def test_sync_queues_cross_checks_for_review(self, admin_client, pilot, sample_data_request):
        res = admin_client.post(f'/api/golive/pilots/{pilot.id}/flag-reviews/',
                                {'requestId': sample_data_request.id}, format='json')
        assert res.status_code == 200
        assert res.data['created'] == len(res.data['reviews']) > 0
        assert all(r['verdict'] == 'PENDING' for r in res.data['reviews'])
        # Re-sync is idempotent.
        again = admin_client.post(f'/api/golive/pilots/{pilot.id}/flag-reviews/',
                                  {'requestId': sample_data_request.id}, format='json')
        assert again.data['created'] == 0

    def test_disagreeing_requires_reason(self, admin_client, pilot, sample_data_request):
        review = FlagReview.objects.create(pilot=pilot, request=sample_data_request, check_id='c1',
                                           severity='warning', system_flagged=True)
        url = f'/api/golive/flag-reviews/{review.id}/'
        assert admin_client.patch(url, {'verdict': 'DISAGREE'}, format='json').status_code == 400
        res = admin_client.patch(url, {'verdict': 'DISAGREE', 'comment': 'Values reconcile.'}, format='json')
        assert res.status_code == 200 and res.data['reviewer']

    def test_completed_pilot_evidence_is_frozen(self, admin_client, pilot, sample_data_request):
        review = FlagReview.objects.create(pilot=pilot, request=sample_data_request, check_id='c1',
                                           severity='warning', system_flagged=True)
        pilot.status = PilotStatus.COMPLETED
        pilot.save()
        res = admin_client.patch(f'/api/golive/flag-reviews/{review.id}/', {'verdict': 'AGREE'}, format='json')
        assert res.status_code == 409


@pytest.mark.django_db
class TestAiReliabilityKpi:
    def _reviews(self, pilot, request, rows):
        for i, (flagged, verdict, critical) in enumerate(rows):
            FlagReview.objects.create(pilot=pilot, request=request, check_id=f'c{i}', severity='error' if critical else 'warning',
                                      critical=critical, system_flagged=flagged, verdict=verdict)

    def test_no_evidence_fails(self, pilot):
        assert flag_reliability(pilot)['passed'] is False

    def test_accuracy_above_target_passes(self, pilot, sample_data_request):
        rows = [(True, FlagVerdict.AGREE, True)] * 10 + [(False, FlagVerdict.AGREE, False)] * 10
        self._reviews(pilot, sample_data_request, rows)
        kpi = flag_reliability(pilot)
        assert kpi['value'] == 1.0 and kpi['passed'] is True

    def test_single_critical_false_positive_fails(self, pilot, sample_data_request):
        rows = [(True, FlagVerdict.AGREE, False)] * 40 + [(True, FlagVerdict.DISAGREE, True)]
        self._reviews(pilot, sample_data_request, rows)
        kpi = flag_reliability(pilot)
        assert kpi['value'] > 0.95
        assert kpi['evidence']['criticalFalsePositives'] == 1
        assert kpi['passed'] is False

    def test_missed_discrepancies_lower_accuracy(self, pilot, sample_data_request):
        rows = [(True, FlagVerdict.AGREE, False)] * 9 + [(False, FlagVerdict.DISAGREE, False)]
        self._reviews(pilot, sample_data_request, rows)
        kpi = flag_reliability(pilot)
        assert kpi['value'] == pytest.approx(0.9)
        assert kpi['evidence']['falseNegatives'] == 1
        assert kpi['passed'] is False

    def test_pending_reviews_block_pass(self, pilot, sample_data_request):
        rows = [(True, FlagVerdict.AGREE, False)] * 20 + [(True, FlagVerdict.PENDING, False)]
        self._reviews(pilot, sample_data_request, rows)
        assert flag_reliability(pilot)['passed'] is False


# ---------------------------------------------------------------------------
# Data-auditability KPI
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAuditabilityKpi:
    def _submission(self, request, unit, **kw):
        return SectionSubmission.objects.create(request=request, org_unit=unit, section_id='s1',
                                                schema_version='1.0.0', **kw)

    def test_fully_logged_submission_passes(self, pilot, sample_data_request, sample_org_unit, sample_officer):
        sub = self._submission(sample_data_request, sample_org_unit, payload={'a': 1},
                               status=SubmissionStatus.SUBMITTED, submitted_at=timezone.now())
        SubmissionAuditLog.objects.create(submission=sub, actor_type='OFFICER', actor_id=sample_officer.id,
                                          action='SUBMIT', delta={})
        kpi = data_auditability(pilot)
        assert kpi['passed'] is True and kpi['value'] == 1.0

    def test_unlogged_review_is_a_gap(self, pilot, sample_data_request, sample_org_unit, sample_officer, admin_user):
        sub = self._submission(sample_data_request, sample_org_unit, payload={'a': 1},
                               status=SubmissionStatus.APPROVED, submitted_at=timezone.now(),
                               reviewed_at=timezone.now(), reviewed_by=admin_user)
        SubmissionAuditLog.objects.create(submission=sub, actor_type='OFFICER', actor_id=sample_officer.id,
                                          action='SUBMIT', delta={})
        kpi = data_auditability(pilot)
        assert kpi['passed'] is False
        assert kpi['evidence']['unloggedChanges'] == [{'submissionId': sub.id, 'missing': 'review'}]

    def test_unresolvable_actor_is_untraced(self, pilot, sample_data_request, sample_org_unit):
        sub = self._submission(sample_data_request, sample_org_unit, payload={'a': 1})
        log = SubmissionAuditLog.objects.create(submission=sub, actor_type='OFFICER', actor_id='ghost',
                                                action='UPDATE', delta={})
        kpi = data_auditability(pilot)
        assert kpi['passed'] is False
        assert kpi['evidence']['untracedAuditRows'] == [log.id]

    def test_scope_excludes_units_outside_pilot(self, pilot, sample_data_request, child_org_unit):
        self._submission(sample_data_request, child_org_unit, payload={'a': 1})
        assert data_auditability(pilot)['evidence']['submissionsInScope'] == 0


# ---------------------------------------------------------------------------
# UAT, training and sign-off
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUatAndSignoff:
    def test_seed_is_idempotent(self):
        call_command('seed_uat_scenarios')
        call_command('seed_uat_scenarios')
        assert UatScenario.objects.filter(active=True).count() >= 15

    def test_failed_result_needs_notes_and_shows_in_readiness(self, admin_client):
        call_command('seed_uat_scenarios')
        url = '/api/golive/uat/scenarios/UAT-01/executions/'
        assert admin_client.post(url, {'status': 'FAIL'}, format='json').status_code == 400
        assert admin_client.post(url, {'status': 'FAIL', 'notes': 'Throttle missing', 'defectRef': 'GH-12'},
                                 format='json').status_code == 201
        gate = next(g for g in admin_client.get('/api/golive/readiness/').data['gates'] if g['key'] == 'uat')
        assert 'UAT-01' in gate['evidence']['failing']
        assert admin_client.post(url, {'status': 'PASS'}, format='json').status_code == 201
        scen = next(s for s in admin_client.get('/api/golive/uat/scenarios/').data if s['code'] == 'UAT-01')
        assert scen['latest']['status'] == 'PASS' and len(scen['history']) == 2

    def test_all_scenarios_passing_opens_uat_gate(self, admin_client):
        call_command('seed_uat_scenarios')
        for code in UatScenario.objects.values_list('code', flat=True):
            admin_client.post(f'/api/golive/uat/scenarios/{code}/executions/', {'status': 'PASS'}, format='json')
        gate = next(g for g in admin_client.get('/api/golive/readiness/').data['gates'] if g['key'] == 'uat')
        assert gate['passed'] is True

    def test_training_gate_needs_officer_and_admin_sessions(self, admin_client):
        for audience in ('NODAL_OFFICER', 'ADMIN'):
            res = admin_client.post('/api/golive/training/', {
                'title': f'{audience} walkthrough', 'audience': audience, 'heldOn': '2026-12-02',
                'trainer': 'Dev team', 'attendees': 12,
            }, format='json')
            assert res.status_code == 201
        gate = next(g for g in admin_client.get('/api/golive/readiness/').data['gates'] if g['key'] == 'training')
        assert gate['passed'] is True

    def test_go_against_no_go_recommendation_needs_justification(self, director_client):
        body = {'kind': 'GO_NO_GO', 'decision': 'APPROVE', 'signatoryName': 'Prof. A',
                'designation': 'Dean, DORA'}
        assert director_client.post('/api/golive/signoffs/', body, format='json').status_code == 400
        res = director_client.post('/api/golive/signoffs/', {**body, 'comment': 'Accepting known risk R-3.'},
                                   format='json')
        assert res.status_code == 201
        assert res.data['readinessSnapshot']['recommendation'] == 'NO_GO'
        assert res.data['recommendationAtSigning'] == 'NO_GO'
        decision = director_client.get('/api/golive/readiness/').data['decision']
        assert decision['signatoryName'] == 'Prof. A'

    def test_signoffs_are_immutable(self, admin_user):
        s = SignOff.objects.create(kind='UAT', decision='APPROVE', signatory_name='A', designation='B',
                                   signed_by=admin_user)
        s.comment = 'edited'
        with pytest.raises(ValidationError):
            s.save()
        with pytest.raises(ValidationError):
            s.delete()


# ---------------------------------------------------------------------------
# Backups and disaster recovery
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBackups:
    def test_create_and_verify(self, backup_env, sample_org_unit):
        path = backup_lib.create_backup(label='test')
        assert path.exists() and (path.parent / (path.name + '.sha256')).exists()
        result = backup_lib.verify_backup(path)
        assert result.ok, result.errors
        assert result.counts.get('organogram.orgunit') == 1
        assert result.files == 1

    def test_tampered_archive_is_refused(self, backup_env, sample_org_unit):
        path = backup_lib.create_backup()
        with open(path, 'ab') as fh:
            fh.write(b'junk')
        result = backup_lib.verify_backup(path)
        assert not result.ok
        with pytest.raises(backup_lib.BackupError):
            backup_lib.restore_backup(path)

    def test_path_traversal_member_is_refused(self, backup_env):
        evil = Path(backup_env) / 'backups'
        evil.mkdir(parents=True, exist_ok=True)
        archive = evil / 'arp-backup-20260101T000000Z.tar.gz'
        src = Path(backup_env) / 'x.txt'
        src.write_text('x')
        with tarfile.open(archive, 'w:gz') as tar:
            tar.add(src, arcname='../escape.txt')
        import hashlib
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        (evil / (archive.name + '.sha256')).write_text(f'{digest}  {archive.name}\n')
        result = backup_lib.verify_backup(archive)
        assert not result.ok and any('Unsafe' in e for e in result.errors)

    def test_retention_prunes_oldest(self, backup_env, settings):
        d = Path(settings.BACKUP_DIR)
        d.mkdir(parents=True)
        for day in range(1, 5):
            (d / f'arp-backup-202601{day:02d}T000000Z.tar.gz').write_bytes(b'x')
        removed = backup_lib.prune_backups(keep=2)
        assert removed == ['arp-backup-20260102T000000Z.tar.gz', 'arp-backup-20260101T000000Z.tar.gz']

    def test_backup_command_records_audit_entry(self, backup_env, sample_org_unit):
        call_command('backup_portal', '--label', 'cmd')
        assert SubmissionAuditLog.objects.filter(action='BACKUP', submission__isnull=True).exists()

    def test_backups_endpoint(self, admin_client, backup_env):
        res = admin_client.post('/api/golive/backups/', {'label': 'pre-release'}, format='json')
        assert res.status_code == 201 and res.data['verified'] is True
        listing = admin_client.get('/api/golive/backups/').data
        assert listing[0]['name'] == res.data['name']
        gate = next(g for g in admin_client.get('/api/golive/readiness/').data['gates'] if g['key'] == 'backups')
        assert gate['passed'] is True


@pytest.mark.django_db(transaction=True)
def test_restore_round_trip(backup_env, sample_org_unit, sample_officer):
    path = backup_lib.create_backup()
    officer_id = sample_officer.pk
    sample_officer.delete()
    sample_org_unit.name = 'Changed after backup'
    sample_org_unit.save()
    proof = Path(backup_env) / 'media' / 'proofs' / 'grant.pdf'
    proof.unlink()

    backup_lib.restore_backup(path)

    from apps.organogram.models import NodalOfficer, OrgUnit
    assert OrgUnit.objects.get(pk=sample_org_unit.pk).name == 'Institute Senate'
    assert NodalOfficer.objects.filter(pk=officer_id).exists()
    assert proof.read_bytes() == b'%PDF-1.4 sanction letter'


@pytest.mark.django_db
class TestDrill:
    def test_drill_passes_when_restore_matches(self, backup_env, sample_org_unit):
        path = backup_lib.create_backup()
        counts = backup_lib.verify_backup(path).counts

        with patch('apps.golive.drill.restore_into_scratch',
                   return_value={'ok': True, 'counts': counts, 'mediaFiles': 1}):
            drill = run_drill(witness='Head, IT Services')
        assert drill.kind == DrillKind.WITNESSED
        assert drill.integrity_ok and drill.meets_targets
        assert system_resilience()['passed'] is True

    def test_drill_fails_on_row_mismatch(self, backup_env, sample_org_unit):
        backup_lib.create_backup()
        with patch('apps.golive.drill.restore_into_scratch',
                   return_value={'ok': True, 'counts': {}, 'mediaFiles': 1}):
            drill = run_drill()
        assert not drill.integrity_ok
        assert 'organogram.orgunit' in drill.details['mismatches']

    def test_stale_backup_breaks_rpo(self, settings):
        now = timezone.now()
        drill = DisasterRecoveryDrill.objects.create(
            kind=DrillKind.WITNESSED, backup_name='old', backup_created_at=now - timedelta(hours=30),
            failure_declared_at=now, restored_at=now + timedelta(hours=1), integrity_ok=True, witnessed_by='W',
        )
        assert drill.rpo_hours == pytest.approx(30)
        assert drill.meets_targets is False

    def test_manual_witnessed_drill_endpoint(self, admin_client):
        now = timezone.now()
        body = {
            'backupName': 'nightly', 'backupCreatedAt': (now - timedelta(hours=6)).isoformat(),
            'failureDeclaredAt': now.isoformat(), 'restoredAt': (now + timedelta(hours=2)).isoformat(),
            'integrityOk': True,
        }
        assert admin_client.post('/api/golive/dr-drills/', body, format='json').status_code == 400
        res = admin_client.post('/api/golive/dr-drills/', {**body, 'witnessedBy': 'Registrar'}, format='json')
        assert res.status_code == 201 and res.data['meetsTargets'] is True
        bad = {**body, 'witnessedBy': 'R', 'restoredAt': (now - timedelta(hours=1)).isoformat()}
        assert admin_client.post('/api/golive/dr-drills/', bad, format='json').status_code == 400
