"""
Re-seeding the organogram must not destroy operator-entered contact details.

The mailboxes in `org_units.json` are placeholders that stand in until the
institute's real addresses are entered after go-live. Both `scripts/deploy.sh`
and the CI pipeline run `seed_organogram` on every deploy, so the command has
to be safe to re-run against a live database.
"""

import pytest
from django.core.management import call_command

from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit


@pytest.fixture
def seeded(db):
    call_command('seed_organogram')


def test_reseed_preserves_operator_mailbox(seeded):
    unit = OrgUnit.objects.get(id='scee')
    placeholder = unit.email
    assert placeholder, 'fixture should ship a placeholder mailbox'

    # Operator replaces the placeholder with the institute's real address.
    unit.email = 'nirf.scee.real@iitmandi.ac.in'
    unit.save(update_fields=['email'])

    call_command('seed_organogram')

    unit.refresh_from_db()
    assert unit.email == 'nirf.scee.real@iitmandi.ac.in', (
        'a deploy re-running the seeder must not revert the mailbox'
    )


def test_reseed_fills_a_blank_mailbox_from_the_fixture(seeded):
    """Units left blank are still (re)populated, so the fixture stays useful."""
    unit = OrgUnit.objects.get(id='scee')
    fixture_value = unit.email
    unit.email = ''
    unit.save(update_fields=['email'])

    call_command('seed_organogram')

    unit.refresh_from_db()
    assert unit.email == fixture_value


def test_reseed_preserves_officer_status_and_name(seeded):
    officer = NodalOfficer.objects.filter(email='chairscee@iitmandi.ac.in').first()
    assert officer is not None
    assert officer.status == OfficerStatus.INVITED

    # Roster UI: the real person is named and activated.
    officer.name = 'Dr. Real Nodal Officer'
    officer.designation = 'Chairperson, SCEE'
    officer.status = OfficerStatus.ACTIVE
    officer.save(update_fields=['name', 'designation', 'status'])

    call_command('seed_organogram')

    officer.refresh_from_db()
    assert officer.status == OfficerStatus.ACTIVE, 'must not be pushed back to INVITED'
    assert officer.name == 'Dr. Real Nodal Officer'
    assert officer.designation == 'Chairperson, SCEE'


def test_reset_contacts_flag_restores_the_fixture(seeded):
    """The destructive behaviour stays available, but only on request."""
    unit = OrgUnit.objects.get(id='scee')
    fixture_value = unit.email
    unit.email = 'nirf.scee.real@iitmandi.ac.in'
    unit.save(update_fields=['email'])

    call_command('seed_organogram', '--reset-contacts')

    unit.refresh_from_db()
    assert unit.email == fixture_value


# -----------------------------------------------------------------------------
# Changing contacts through the API
# -----------------------------------------------------------------------------

@pytest.fixture
def admin_user(db):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(
        username='contact_admin',
        email='contact_admin@iitmandi.ac.in',
        password='password123',
        role='ADMIN',
    )


@pytest.fixture
def admin_client(admin_user):
    from rest_framework.test import APIClient
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


def test_admin_can_change_a_unit_mailbox(seeded, admin_client):
    res = admin_client.patch(
        '/api/organogram/units/scee/contact/',
        {'email': 'nirf.scee@iitmandi.ac.in', 'head': 'Dr. New Chair'},
        format='json',
    )
    assert res.status_code == 200, res.content
    assert res.data['unit']['email'] == 'nirf.scee@iitmandi.ac.in'
    assert res.data['unit']['head'] == 'Dr. New Chair'

    unit = OrgUnit.objects.get(id='scee')
    assert unit.email == 'nirf.scee@iitmandi.ac.in'

    # The seeded officer follows the mailbox so dispatch reaches the new inbox.
    officer = NodalOfficer.objects.get(id='seed-scee')
    assert officer.email == 'nirf.scee@iitmandi.ac.in'
    assert unit in officer.assigned_units.all()


def test_mailbox_change_survives_a_redeploy(seeded, admin_client):
    admin_client.patch(
        '/api/organogram/units/scee/contact/',
        {'email': 'nirf.scee@iitmandi.ac.in'},
        format='json',
    )
    call_command('seed_organogram')
    assert OrgUnit.objects.get(id='scee').email == 'nirf.scee@iitmandi.ac.in'


def test_invalid_mailbox_is_rejected(seeded, admin_client):
    res = admin_client.patch(
        '/api/organogram/units/scee/contact/',
        {'email': 'not-an-email'},
        format='json',
    )
    assert res.status_code == 400
    assert OrgUnit.objects.get(id='scee').email == 'chairscee@iitmandi.ac.in'


def test_coverage_report_lists_unreachable_units(seeded, admin_client):
    res = admin_client.get('/api/organogram/coverage/')
    assert res.status_code == 200, res.content
    summary = res.data['summary']

    # The three schools and six centres with no placeholder mailbox.
    assert set(summary['unreachableAcademicUnits']) == {
        'smme', 'scs', 'sps', 'iksmha', 'c3dar', 'c4dfed', 'cair', 'chci', 'biox',
    }
    assert summary['academicUnits'] == 17
    assert summary['reachableAcademicUnits'] == 8


def test_setting_a_mailbox_makes_a_unit_reachable(seeded, admin_client):
    admin_client.patch(
        '/api/organogram/units/smme/contact/',
        {'email': 'nirf.smme@iitmandi.ac.in'},
        format='json',
    )
    # A mailbox alone is not enough; an officer must be assigned to the unit.
    officer = NodalOfficer.objects.create(
        name='SMME Officer', email='smme.officer@iitmandi.ac.in', status=OfficerStatus.ACTIVE
    )
    officer.assigned_units.add(OrgUnit.objects.get(id='smme'))

    res = admin_client.get('/api/organogram/coverage/')
    assert 'smme' not in res.data['summary']['unreachableAcademicUnits']
