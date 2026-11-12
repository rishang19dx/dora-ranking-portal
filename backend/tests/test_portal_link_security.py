"""
Edge cases around the single-purpose upload links.

A grant is the only thing standing between a public URL and an institute's
NIRF data, so each way a link can be created, rotated, revoked or outlived
is exercised here.
"""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.data_requests.models import DataRequest, PortalAccessGrant
from apps.data_requests.services import dispatch_data_request, hash_token
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit

User = get_user_model()


@pytest.fixture
def seeded(db):
    from django.core.management import call_command
    call_command('seed_organogram')
    call_command('load_form_schema')


@pytest.fixture
def admin_client(seeded):
    user = User.objects.create_user(
        username='link_admin', email='link_admin@iitmandi.ac.in',
        password='pw', role='ADMIN',
    )
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def officer(seeded):
    unit = OrgUnit.objects.get(id='scee')
    o = NodalOfficer.objects.create(
        name='SCEE Nodal', email='scee_link@iitmandi.ac.in', status=OfficerStatus.ACTIVE
    )
    o.assigned_units.add(unit)
    return o


def _dispatch(officer, reference_suffix='A'):
    req, grants = dispatch_data_request(
        title=f'NIRF 2027 link test {reference_suffix}',
        framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline='2027-01-31T23:59:59Z',
        sections=[{'unitId': 'scee', 'dataItemIds': ['student-intake']}],
        categories=['OVERALL'],
    )
    grant = next(g for g in grants if g['officerId'] == officer.id)
    return req, grant['portalUrl'].split('/portal/')[1]


def _probe(client, token):
    """Returns the status code the portal context endpoint gives for a token."""
    return client.get(f'/api/portal/{token}/').status_code


# -----------------------------------------------------------------------------
# Baseline
# -----------------------------------------------------------------------------

def test_raw_token_is_never_persisted(officer):
    _req, token = _dispatch(officer)
    assert PortalAccessGrant.objects.filter(token_hash=token).count() == 0
    assert PortalAccessGrant.objects.filter(token_hash=hash_token(token)).count() == 1


def test_valid_link_works_and_unknown_token_is_rejected(officer, client):
    _req, token = _dispatch(officer)
    assert _probe(client, token) == 200
    assert _probe(client, 'not-a-real-token') == 404


def test_expired_link_is_rejected(officer, client):
    _req, token = _dispatch(officer)
    PortalAccessGrant.objects.filter(token_hash=hash_token(token)).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    assert _probe(client, token) == 403


def test_closing_a_request_kills_its_links(officer, client, admin_client):
    req, token = _dispatch(officer)
    assert _probe(client, token) == 200
    res = admin_client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'close'}, format='json')
    assert res.status_code == 200
    assert _probe(client, token) == 403


def test_deleting_the_officer_kills_their_links(officer, client):
    _req, token = _dispatch(officer)
    officer.delete()
    assert _probe(client, token) == 404


# -----------------------------------------------------------------------------
# Rotation
# -----------------------------------------------------------------------------

def test_reminder_rotates_the_link(officer, client, admin_client):
    """A reminder issues a fresh link; the superseded one must stop working."""
    req, first_token = _dispatch(officer)
    assert _probe(client, first_token) == 200

    res = admin_client.post(
        f'/api/data-requests/{req.id}/actions/',
        {'action': 'remind', 'unitIds': ['scee']}, format='json',
    )
    assert res.status_code == 200
    assert _probe(client, first_token) == 403, 'the superseded link must be revoked'

    live = PortalAccessGrant.objects.filter(
        request=req, officer=officer, revoked_at__isnull=True
    ).count()
    assert live == 1, f'exactly one live grant expected, found {live}'


def test_reissue_rotates_the_link(officer, client, admin_client):
    req, first_token = _dispatch(officer)
    res = admin_client.post(
        f'/api/data-requests/{req.id}/actions/',
        {'action': 'reissue', 'unitId': 'scee', 'officerId': officer.id}, format='json',
    )
    assert res.status_code == 200
    new_token = res.data['url'].split('/portal/')[1]

    assert _probe(client, first_token) == 403
    assert _probe(client, new_token) == 200


# -----------------------------------------------------------------------------
# Closed requests must not mint working links
# -----------------------------------------------------------------------------

def test_reminder_on_a_closed_request_issues_no_working_link(officer, client, admin_client):
    req, _token = _dispatch(officer)
    admin_client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'close'}, format='json')

    admin_client.post(
        f'/api/data-requests/{req.id}/actions/',
        {'action': 'remind', 'unitIds': ['scee']}, format='json',
    )
    live = [
        g for g in PortalAccessGrant.objects.filter(request=req, revoked_at__isnull=True)
    ]
    assert not live, 'a closed request must not have live grants'


def test_reissue_on_a_closed_request_is_refused(officer, client, admin_client):
    req, _token = _dispatch(officer)
    admin_client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'close'}, format='json')

    res = admin_client.post(
        f'/api/data-requests/{req.id}/actions/',
        {'action': 'reissue', 'unitId': 'scee', 'officerId': officer.id}, format='json',
    )
    assert res.status_code == 400, 'reissuing into a closed request should be refused'


def test_reopening_a_request_restores_access(officer, client, admin_client):
    req, _token = _dispatch(officer)
    admin_client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'close'}, format='json')

    res = admin_client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'reopen'}, format='json')
    assert res.status_code == 200
    new_links = res.data.get('issuedGrants') or []
    assert new_links, 'reopening should hand back usable links'
    token = new_links[0]['portalUrl'].split('/portal/')[1]
    assert _probe(client, token) == 200


# -----------------------------------------------------------------------------
# Officer standing
# -----------------------------------------------------------------------------

def test_revoked_officer_cannot_use_an_outstanding_link(officer, client):
    _req, token = _dispatch(officer)
    officer.status = OfficerStatus.REVOKED
    officer.save(update_fields=['status'])
    assert _probe(client, token) == 403


def test_revoked_officer_is_not_issued_a_fallback_grant(seeded, client):
    """
    A unit whose only officer is revoked must not get a link through the
    unit-email fallback path.
    """
    unit = OrgUnit.objects.get(id='sbs')
    revoked = NodalOfficer.objects.filter(email=unit.email).first()
    assert revoked is not None
    revoked.status = OfficerStatus.REVOKED
    revoked.save(update_fields=['status'])

    _req, grants = dispatch_data_request(
        title='NIRF 2027 revoked fallback', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline='2027-01-31T23:59:59Z',
        sections=[{'unitId': 'sbs', 'dataItemIds': ['student-intake']}],
        categories=['OVERALL'],
    )
    assert not grants, 'no grant should be issued to a revoked officer'


def test_unassigning_the_unit_kills_the_link(officer, client, admin_client):
    _req, token = _dispatch(officer)
    assert _probe(client, token) == 200

    res = admin_client.patch(
        f'/api/nodal-officers/{officer.id}/', {'unitIds': []}, format='json',
    )
    assert res.status_code == 200
    assert _probe(client, token) == 403, (
        'an officer no longer representing the unit must lose the link'
    )


# -----------------------------------------------------------------------------
# Dispatch input edge cases
# -----------------------------------------------------------------------------

def test_duplicate_unit_in_one_dispatch_does_not_error(officer):
    """
    The composer can send the same section twice (a unit selected under two
    categories). A target is unique per request+unit, so this must merge
    rather than raise.
    """
    req, grants = dispatch_data_request(
        title='NIRF 2027 duplicate section', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline='2027-01-31T23:59:59Z',
        sections=[
            {'unitId': 'scee', 'dataItemIds': ['student-intake']},
            {'unitId': 'scee', 'dataItemIds': ['faculty-roster']},
        ],
        categories=['OVERALL', 'ENGINEERING'],
    )
    assert req.targets.filter(org_unit_id='scee').count() == 1
    target = req.targets.get(org_unit_id='scee')
    assert set(target.data_item_ids) == {'student-intake', 'faculty-roster'}

    # One live link for the officer, scoped to the merged item set.
    live = PortalAccessGrant.objects.filter(
        request=req, officer=officer, revoked_at__isnull=True
    )
    assert live.count() == 1
    assert set(live.first().data_item_ids) == {'student-intake', 'faculty-roster'}


def test_unknown_unit_is_skipped(officer):
    req, _grants = dispatch_data_request(
        title='NIRF 2027 unknown unit', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline='2027-01-31T23:59:59Z',
        sections=[
            {'unitId': 'does-not-exist', 'dataItemIds': ['student-intake']},
            {'unitId': 'scee', 'dataItemIds': ['student-intake']},
        ],
        categories=['OVERALL'],
    )
    assert [t.org_unit_id for t in req.targets.all()] == ['scee']


def test_unit_without_a_mailbox_yields_no_link(seeded):
    """A unit with no mailbox and no officer is reported, not crashed on."""
    assert not OrgUnit.objects.get(id='smme').email
    req, grants = dispatch_data_request(
        title='NIRF 2027 no mailbox', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline='2027-01-31T23:59:59Z',
        sections=[{'unitId': 'smme', 'dataItemIds': ['student-intake']}],
        categories=['OVERALL'],
    )
    assert grants == []
    assert req.targets.filter(org_unit_id='smme').exists(), (
        'the target is still recorded so the gap is visible to the admin'
    )


def test_links_from_different_requests_are_independent(officer, client):
    """Rotating one cycle's link must not disturb another cycle's."""
    _req_a, token_a = _dispatch(officer, 'A')
    _req_b, token_b = _dispatch(officer, 'B')
    assert _probe(client, token_a) == 200
    assert _probe(client, token_b) == 200


def test_rejection_tells_the_officer_why(officer, client, admin_client):
    """
    The portal page renders whatever reason the API returns, so each cause is
    distinguishable rather than a single generic 'expired or revoked'.
    """
    req, token = _dispatch(officer)
    admin_client.post(f'/api/data-requests/{req.id}/actions/', {'action': 'close'}, format='json')
    body = client.get(f'/api/portal/{token}/').json()
    assert 'revoked' in body['error'].lower()

    _req2, token2 = _dispatch(officer, 'B')
    officer.assigned_units.clear()
    body2 = client.get(f'/api/portal/{token2}/').json()
    assert 'no longer represents' in body2['error'].lower(), body2
