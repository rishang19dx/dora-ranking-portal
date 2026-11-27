"""
Automated deadline reminders (spec 2.5; Phase 3 acceptance: "automated
reminders trigger appropriately based on predefined deadlines").

Time is driven by passing `now` to the scheduler, so every milestone can be
exercised without waiting for it.
"""
from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.data_requests.models import (
    DataRequest,
    DataRequestStatus,
    DataRequestTarget,
    DeliveryKind,
    PortalAccessGrant,
    ReminderOutcome,
    RequestDelivery,
    ScheduledReminder,
    TargetStatus,
)
from apps.data_requests.reminders import milestones_for, run_scheduled_reminders, schedule_for
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit, OrgUnitType

POLICY = dict(
    REMINDER_DAYS_BEFORE=[7, 3, 1],
    REMINDER_OVERDUE_INTERVAL_DAYS=3,
    REMINDER_OVERDUE_MAX=2,
    REMINDER_MANUAL_COOLDOWN_HOURS=20,
)

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures('_policy', '_outbox')]


@pytest.fixture
def _policy(settings):
    for k, v in POLICY.items():
        setattr(settings, k, v)


@pytest.fixture
def _outbox(settings, tmp_path):
    settings.OUTBOX_DIR = tmp_path / 'outbox'
    settings.RESEND_API_KEY = None


@pytest.fixture
def cycle(db):
    """A request dispatched now, due in 10 days, to two sections."""
    units = []
    for uid in ('sbs', 'scee'):
        unit = OrgUnit.objects.create(id=uid, name=uid.upper(), short_name=uid.upper(), type=OrgUnitType.ACADEMIC)
        officer = NodalOfficer.objects.create(name=f'Officer {uid}', email=f'{uid}@iitmandi.ac.in', status=OfficerStatus.ACTIVE)
        officer.assigned_units.add(unit)
        units.append(unit)
    req = DataRequest.objects.create(
        reference='DORA/2027/NIRF/R1', title='NIRF 2027 data', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline=timezone.now() + timedelta(days=10), data_item_ids=['faculty-roster'],
    )
    targets = [
        DataRequestTarget.objects.create(request=req, org_unit=u, data_item_ids=['faculty-roster'])
        for u in units
    ]
    return req, targets


def at(req, **delta):
    """A moment relative to the request's deadline."""
    return req.deadline + timedelta(**delta)


def sent_keys(req):
    return sorted(
        (r.target.org_unit_id, r.milestone)
        for r in ScheduledReminder.objects.filter(request=req, outcome=ReminderOutcome.SENT)
    )


def test_schedule_is_relative_to_the_deadline(cycle):
    req, _ = cycle
    keys = [m.key for m in milestones_for(req.deadline)]
    assert keys == ['T-7', 'T-3', 'T-1', 'OVERDUE-1', 'OVERDUE-2']
    by_key = {m.key: m for m in milestones_for(req.deadline)}
    assert by_key['T-3'].due_at == req.deadline - timedelta(days=3)
    assert by_key['OVERDUE-2'].due_at == req.deadline + timedelta(days=3, hours=1)


def test_nothing_is_sent_before_the_first_milestone(cycle):
    req, _ = cycle
    report = run_scheduled_reminders(now=at(req, days=-8))
    assert report['sent'] == [] and not ScheduledReminder.objects.exists()


def test_each_milestone_is_sent_once_per_section(cycle):
    req, _ = cycle
    report = run_scheduled_reminders(now=at(req, days=-7, minutes=1))
    assert {(s['unitId'], s['milestone']) for s in report['sent']} == {('sbs', 'T-7'), ('scee', 'T-7')}
    # Re-running inside the same window sends nothing more.
    assert run_scheduled_reminders(now=at(req, days=-6))['sent'] == []
    assert RequestDelivery.objects.filter(kind=DeliveryKind.REMINDER).count() == 2

    run_scheduled_reminders(now=at(req, days=-3, minutes=1))
    assert sent_keys(req) == [('sbs', 'T-3'), ('sbs', 'T-7'), ('scee', 'T-3'), ('scee', 'T-7')]


def test_submitted_sections_closed_and_paused_requests_get_nothing(cycle):
    req, (sbs, scee) = cycle
    sbs.status = TargetStatus.SUBMITTED
    sbs.save()
    report = run_scheduled_reminders(now=at(req, days=-7, minutes=1))
    assert [s['unitId'] for s in report['sent']] == ['scee']

    req.auto_remind = False
    req.save()
    assert run_scheduled_reminders(now=at(req, days=-3, minutes=1))['sent'] == []

    req.auto_remind = True
    req.status = DataRequestStatus.CLOSED
    req.save()
    assert run_scheduled_reminders(now=at(req, days=-1, minutes=1))['sent'] == []


def test_partial_sections_are_still_chased(cycle):
    """A correction request sends a section back to PARTIAL; it must be reminded."""
    req, (sbs, scee) = cycle
    sbs.status = TargetStatus.PARTIAL
    sbs.save()
    scee.status = TargetStatus.SUBMITTED
    scee.save()
    report = run_scheduled_reminders(now=at(req, days=-1, minutes=1))
    assert [s['unitId'] for s in report['sent']] == ['sbs']


def test_catch_up_sends_one_mail_not_a_backlog(cycle):
    req, _ = cycle
    # The scheduler was down from before T-7 until after T-1.
    report = run_scheduled_reminders(now=at(req, hours=-12))
    assert {s['milestone'] for s in report['sent']} == {'T-1'}
    assert RequestDelivery.objects.filter(kind=DeliveryKind.REMINDER).count() == 2
    skipped = ScheduledReminder.objects.filter(outcome=ReminderOutcome.SKIPPED).values_list('milestone', flat=True)
    assert sorted(skipped) == ['T-3', 'T-3', 'T-7', 'T-7']


def test_milestones_already_past_at_dispatch_are_not_sent(cycle):
    req, _ = cycle
    # Dispatched only two days before its deadline: T-7 and T-3 never apply.
    req.dispatched_at = at(req, days=-2)
    req.save()
    report = run_scheduled_reminders(now=at(req, days=-2, hours=1))
    assert report['sent'] == []
    assert {s['milestone'] for s in report['skipped']} == {'T-3'}
    report = run_scheduled_reminders(now=at(req, days=-1, minutes=1))
    assert {s['milestone'] for s in report['sent']} == {'T-1'}


def test_manual_remind_action_uses_the_shared_sender(cycle):
    req, (sbs, _) = cycle
    admin = User.objects.create_user(username='a', email='a@iitmandi.ac.in', password='x', role='ADMIN')
    client = APIClient()
    client.force_authenticate(user=admin)
    res = client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'REMIND', 'unitIds': ['sbs']}, format='json')
    assert res.status_code == 200 and '1 reminder' in res.json()['message']
    sbs.refresh_from_db()
    assert sbs.reminders_sent == 1 and sbs.last_reminder_at is not None
    assert RequestDelivery.objects.get(kind=DeliveryKind.REMINDER).subject.startswith('Reminder:')


def test_recent_manual_reminder_suppresses_the_automated_one(cycle):
    req, (sbs, _) = cycle
    # DORA chased this section by hand an hour before T-7 fell due.
    sbs.last_reminder_at = at(req, days=-7, hours=-1)
    sbs.save()
    report = run_scheduled_reminders(now=at(req, days=-7, minutes=1))
    assert [s['unitId'] for s in report['sent']] == ['scee']
    assert report['skipped'][0]['unitId'] == 'sbs'
    assert 'recently' in report['skipped'][0]['reason']
    # The suppressed milestone is settled, not retried on the next run.
    assert run_scheduled_reminders(now=at(req, days=-6))['sent'] == []


def test_overdue_chases_are_marked_and_capped(cycle):
    req, _ = cycle
    run_scheduled_reminders(now=at(req, days=-1, minutes=1))  # T-1
    run_scheduled_reminders(now=at(req, minutes=30))
    assert not ScheduledReminder.objects.filter(milestone__startswith='OVERDUE').exists(), \
        'a last-minute submission gets an hour to land'

    report = run_scheduled_reminders(now=at(req, hours=2))
    assert {s['milestone'] for s in report['sent']} == {'OVERDUE-1'}
    overdue_mail = RequestDelivery.objects.filter(subject__startswith='Overdue:')
    assert overdue_mail.count() == 2

    run_scheduled_reminders(now=at(req, days=3, hours=2))
    assert run_scheduled_reminders(now=at(req, days=30))['sent'] == [], 'capped at REMINDER_OVERDUE_MAX'
    assert ScheduledReminder.objects.filter(outcome=ReminderOutcome.SENT, milestone='OVERDUE-2').count() == 2


def test_reminder_rotates_the_upload_link_and_writes_the_email(cycle, settings):
    req, (sbs, _) = cycle
    officer = NodalOfficer.objects.get(email='sbs@iitmandi.ac.in')
    from apps.data_requests.services import issue_grant
    old_grant, _, _ = issue_grant(req, sbs.org_unit, officer, sbs.data_item_ids)

    run_scheduled_reminders(now=at(req, days=-3, minutes=1))

    old_grant.refresh_from_db()
    assert old_grant.revoked_at is not None, 'the link in the earlier mail must stop working'
    live = PortalAccessGrant.objects.filter(officer=officer, request=req, revoked_at__isnull=True)
    assert live.count() == 1

    mails = list(settings.OUTBOX_DIR.glob('*.txt'))
    body = next(m.read_text() for m in mails if 'sbs@iitmandi.ac.in' in m.read_text())
    assert 'Reminder: DORA/2027/NIRF/R1' in body
    assert '3 days from now' in body
    assert '{{' not in body, 'every template variable is filled'


def test_section_without_any_recipient_is_recorded_not_crashed(cycle):
    req, (sbs, _) = cycle
    NodalOfficer.objects.filter(email='sbs@iitmandi.ac.in').delete()
    report = run_scheduled_reminders(now=at(req, days=-7, minutes=1))
    row = ScheduledReminder.objects.get(target=sbs, milestone='T-7')
    assert row.deliveries == 0 and 'No eligible officer' in row.detail
    assert {s['unitId'] for s in report['sent']} == {'sbs', 'scee'}


def test_dry_run_records_nothing(cycle):
    req, _ = cycle
    report = run_scheduled_reminders(now=at(req, days=-7, minutes=1), dry_run=True)
    assert len(report['sent']) == 2
    assert not ScheduledReminder.objects.exists()
    assert not RequestDelivery.objects.exists()


def test_timeline_shows_sent_and_upcoming(cycle):
    req, _ = cycle
    run_scheduled_reminders(now=at(req, days=-7, minutes=1))
    req = DataRequest.objects.prefetch_related('targets', 'scheduled_reminders__target').get(pk=req.pk)
    timeline = {row['milestone']: row for row in schedule_for(req, now=at(req, days=-6))}
    assert timeline['T-7']['state'] == 'SENT' and len(timeline['T-7']['sections']) == 2
    assert timeline['T-3']['state'] == 'UPCOMING' and timeline['T-3']['sectionsAwaiting'] == 2


def test_management_command(cycle):
    req, _ = cycle
    req.deadline = timezone.now() + timedelta(days=2, hours=12)
    req.dispatched_at = timezone.now() - timedelta(days=5)
    req.save()
    out = StringIO()
    call_command('send_reminders', '--dry-run', stdout=out)
    assert 'Would send T-3' in out.getvalue()
    assert not ScheduledReminder.objects.exists()
    call_command('send_reminders', stdout=out)
    assert ScheduledReminder.objects.filter(milestone='T-3', outcome=ReminderOutcome.SENT).count() == 2


@override_settings(**POLICY)
def test_reminder_api_roles(cycle):
    req, _ = cycle
    director = User.objects.create_user(username='d', email='d@iitmandi.ac.in', password='x', role='DIRECTOR')
    admin = User.objects.create_user(username='a', email='a@iitmandi.ac.in', password='x', role='ADMIN')
    client = APIClient()

    client.force_authenticate(user=director)
    body = client.get('/api/reminders/').json()
    assert body['policy']['daysBefore'] == [7, 3, 1]
    assert body['requests'][0]['reference'] == req.reference
    assert [m['milestone'] for m in body['requests'][0]['timeline']][:3] == ['T-7', 'T-3', 'T-1']
    assert client.post('/api/reminders/', {}, format='json').status_code == 403

    client.force_authenticate(user=admin)
    preview = client.post('/api/reminders/', {'dryRun': True}, format='json')
    assert preview.status_code == 200 and preview.json()['dryRun'] is True

    paused = client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'SET_AUTO_REMIND', 'enabled': False}, format='json')
    assert paused.status_code == 200
    req.refresh_from_db()
    assert req.auto_remind is False
