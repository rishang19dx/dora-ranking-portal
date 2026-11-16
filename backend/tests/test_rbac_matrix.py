"""
Role-based access control, end to end (spec 2.18, Phase 3 "comprehensive
RBAC testing").

    Admin/Staff     full access
    Nodal Officer   own department only
    Director        read-only: dashboards, analytics, reports
    Auditor         read-only: proofs, audit log, submission trails

Three layers:
  1. A matrix of every protected endpoint against every role.
  2. A structural guard: walking the URL conf, any view that is public must
     be on an explicit allowlist, so a new endpoint cannot ship open by
     omission (the default permission is now IsAuthenticated).
  3. Behavioural checks for the parts a status code cannot show: contact
     stripping, department scoping, login, and the user-management guards.
"""
import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.permissions import AllowAny
from rest_framework.test import APIClient

from apps.data_requests.models import DataRequestTarget, TargetStatus
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit, OrgUnitType

User = get_user_model()

ANON = 'ANON'
NODAL = 'NODAL_OFFICER'
AUDITOR = 'AUDITOR'
DIRECTOR = 'DIRECTOR'
ADMIN = 'ADMIN'
SUPERUSER = 'SUPERUSER'  # createsuperuser account: stored role is the NODAL_OFFICER default

ROLES = [ANON, NODAL, AUDITOR, DIRECTOR, ADMIN, SUPERUSER]
PUBLIC = set(ROLES)
SIGNED_IN = {NODAL, AUDITOR, DIRECTOR, ADMIN, SUPERUSER}
OVERSIGHT = {AUDITOR, DIRECTOR, ADMIN, SUPERUSER}
ADMIN_ONLY = {ADMIN, SUPERUSER}


def make_client(role):
    client = APIClient()
    if role == ANON:
        return client
    if role == SUPERUSER:
        user = User.objects.create_superuser(username='root', email='root@iitmandi.ac.in', password='x')
    else:
        user = User.objects.create_user(
            username=role.lower(), email=f'{role.lower()}@iitmandi.ac.in', password='x', role=role,
        )
    client.force_authenticate(user=user)
    return client


# (method, path, roles allowed). Ids that do not exist are deliberate: the
# permission check runs before the lookup, so an allowed role gets 404/400
# and a denied one gets 401/403 - which is exactly the distinction tested.
MATRIX = [
    # Data collection: requests are the submission trail.
    ('get', '/api/data-requests/', OVERSIGHT),
    ('post', '/api/data-requests/', ADMIN_ONLY),
    ('get', '/api/data-requests/req_missing/', OVERSIGHT),
    ('post', '/api/data-requests/req_missing/actions/', ADMIN_ONLY),
    # Nodal officer roster: personal contacts.
    ('get', '/api/nodal-officers/', OVERSIGHT),
    ('post', '/api/nodal-officers/', ADMIN_ONLY),
    ('get', '/api/nodal-officers/no_missing/', OVERSIGHT),
    ('patch', '/api/nodal-officers/no_missing/', ADMIN_ONLY),
    ('put', '/api/nodal-officers/no_missing/', ADMIN_ONLY),
    ('delete', '/api/nodal-officers/no_missing/', ADMIN_ONLY),
    ('get', '/api/nodal-officers/no_missing/access/', ADMIN_ONLY),
    ('post', '/api/nodal-officers/no_missing/access/', ADMIN_ONLY),
    # Organogram maintenance.
    ('get', '/api/organogram/coverage/', OVERSIGHT),
    ('patch', '/api/organogram/units/missing/contact/', ADMIN_ONLY),
    ('get', '/api/programmes/', OVERSIGHT),
    ('post', '/api/programmes/', ADMIN_ONLY),
    ('get', '/api/programmes/missing/', OVERSIGHT),
    ('put', '/api/programmes/missing/', ADMIN_ONLY),
    ('delete', '/api/programmes/missing/', ADMIN_ONLY),
    ('post', '/api/programmes/import/', ADMIN_ONLY),
    # Maker-checker review.
    ('get', '/api/submissions/', OVERSIGHT),
    ('get', '/api/submissions/missing/', OVERSIGHT),
    ('post', '/api/submissions/missing/actions/', ADMIN_ONLY),
    # Auditor interfaces.
    ('get', '/api/audit-log/', OVERSIGHT),
    ('get', '/api/proofs/', OVERSIGHT),
    ('get', '/api/proofs/missing/download/', OVERSIGHT),
    # Reports and exports.
    ('get', '/api/nirf/cycles/2026/rollup/', OVERSIGHT),
    ('get', '/api/nirf/cycles/2026/export/?category=OVERALL', OVERSIGHT),
    ('get', '/api/nirf/cycles/2026/briefing/', OVERSIGHT),
    ('get', '/api/nirf/history/?unitId=scee&sectionId=x', OVERSIGHT),
    # Ingestion of published results.
    ('post', '/api/v1/scraper/update/', ADMIN_ONLY),
    # Accounts.
    ('get', '/api/auth/me/', SIGNED_IN),
    ('get', '/api/auth/users/', ADMIN_ONLY),
    ('post', '/api/auth/users/', ADMIN_ONLY),
    ('get', '/api/auth/users/999999/', ADMIN_ONLY),
    ('patch', '/api/auth/users/999999/', ADMIN_ONLY),
    ('get', '/api/me/assignments/', SIGNED_IN),
    # Automated reminders (2.5).
    ('get', '/api/reminders/', OVERSIGHT),
    ('post', '/api/reminders/', ADMIN_ONLY),
    # Public portal (spec 2.14).
    ('get', '/api/organogram/', PUBLIC),
    ('get', '/api/v1/rankings/trends/', PUBLIC),
    ('get', '/api/v1/rankings/parameters/trends/', PUBLIC),
    ('get', '/api/v1/rankings/gap-analysis/', PUBLIC),
    ('get', '/api/form-schemas/nirf/', PUBLIC),
]

# Allowed calls that would reach the network or do heavy work are only
# checked for denial; their allowed path is covered by their own suites.
DENIAL_ONLY = {('post', '/api/v1/scraper/update/')}


@pytest.mark.django_db
@pytest.mark.parametrize('role', ROLES)
@pytest.mark.parametrize('method,path,allowed', MATRIX, ids=[f'{m.upper()} {p}' for m, p, _ in MATRIX])
def test_endpoint_role_matrix(role, method, path, allowed):
    if role in allowed and (method, path) in DENIAL_ONLY:
        pytest.skip('allowed path covered elsewhere')
    client = make_client(role)
    res = getattr(client, method)(path, data={}, format='json')
    if role in allowed:
        assert res.status_code not in (401, 403), f'{role} should reach {method.upper()} {path}, got {res.status_code}'
    else:
        expected = (401, 403) if role == ANON else (403,)
        assert res.status_code in expected, f'{role} must be refused {method.upper()} {path}, got {res.status_code}'


@pytest.mark.django_db
@pytest.mark.parametrize('role', [NODAL, AUDITOR, DIRECTOR])
def test_read_only_roles_cannot_approve_dispatch_or_export_changes(role, sample_data_request):
    """The spec's headline rule: only the Data Officer changes data."""
    client = make_client(role)
    assert client.post('/api/data-requests/', {'title': 'x'}, format='json').status_code == 403
    assert client.post(
        f'/api/data-requests/{sample_data_request.id}/actions/', {'action': 'CLOSE'}, format='json'
    ).status_code == 403
    assert client.post('/api/submissions/any/actions/', {'action': 'approve'}, format='json').status_code == 403
    sample_data_request.refresh_from_db()
    assert sample_data_request.status == 'DISPATCHED'


# ---------------------------------------------------------------------------
# Structural guard
# ---------------------------------------------------------------------------

# Every view allowed to answer anonymous callers, and why.
PUBLIC_VIEWS = {
    # Published NIRF results - the public portal (2.14).
    'RootRankingWelcomeView', 'GetRankingsView', 'GetSecondGenIITsView', 'GetRankingByRankView',
    'TrendsAnalyticsView', 'ParameterTrendsView', 'GapAnalysisView',
    'PublicRankingSystemsView',
    # Institute structure, contacts stripped for the public.
    'OrganogramOverviewView',
    # Blank form definitions and Excel templates carry no institutional data.
    'ActiveFormSchemaView', 'ResolvedFormSchemaView', 'RecordsTemplateView',
    # Authorised by the single-purpose upload-link token instead of a session.
    'PortalGrantContextView', 'PortalUploadView', 'PortalFormsView', 'PortalFormSaveView',
    'PortalFormSubmitView', 'PortalRecordsImportView', 'PortalRecordConfirmView',
    # Login itself.
    'CustomTokenObtainPairView', 'TokenRefreshView',
}


def _walk(patterns, prefix=''):
    for p in patterns:
        if isinstance(p, URLResolver):
            if str(p.pattern).startswith('admin/'):
                continue  # Django admin site: its own staff login
            yield from _walk(p.url_patterns, prefix + str(p.pattern))
        elif isinstance(p, URLPattern):
            view_class = getattr(p.callback, 'view_class', None) or getattr(p.callback, 'cls', None)
            if view_class is not None:
                yield prefix + str(p.pattern), view_class


def _is_public(view_class):
    perms = list(getattr(view_class, 'permission_classes', []))
    return not perms or any(issubclass(c, AllowAny) for c in perms)


def test_no_endpoint_is_public_by_omission():
    open_views = {
        view_class.__name__: route
        for route, view_class in _walk(get_resolver().url_patterns)
        if _is_public(view_class)
    }
    unexpected = {name: route for name, route in open_views.items() if name not in PUBLIC_VIEWS}
    assert not unexpected, f'Public endpoints not on the allowlist: {unexpected}'


def test_default_permission_denies():
    from django.conf import settings
    assert settings.REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] == (
        'rest_framework.permissions.IsAuthenticated',
    )


# ---------------------------------------------------------------------------
# Behaviour behind the status codes
# ---------------------------------------------------------------------------

@pytest.fixture
def seeded(db):
    call_command('seed_organogram', verbosity=0)


@pytest.mark.parametrize('role,sees_contacts', [
    (ANON, False), (NODAL, False), (AUDITOR, True), (DIRECTOR, True), (ADMIN, True),
])
def test_organogram_mailboxes_only_for_oversight(seeded, role, sees_contacts):
    res = make_client(role).get('/api/organogram/')
    assert res.status_code == 200
    units = res.data['units']
    assert units, 'structure itself stays public'
    has_email_key = any('email' in u for u in units)
    assert has_email_key is sees_contacts
    if sees_contacts:
        assert any(u['email'] for u in units)


@pytest.mark.django_db
def test_officer_sees_only_their_own_assignments(sample_data_request):
    own = OrgUnit.objects.create(id='own-dept', name='Own Dept', type=OrgUnitType.ACADEMIC)
    other = OrgUnit.objects.create(id='other-dept', name='Other Dept', type=OrgUnitType.ACADEMIC)
    for unit in (own, other):
        DataRequestTarget.objects.create(
            request=sample_data_request, org_unit=unit, data_item_ids=[], status=TargetStatus.PENDING,
        )
    officer = NodalOfficer.objects.create(name='Head', email='head@iitmandi.ac.in', status=OfficerStatus.ACTIVE)
    officer.assigned_units.add(own)
    user = User.objects.create_user(username='head', email='HEAD@iitmandi.ac.in', password='x', role=NODAL)

    client = APIClient()
    client.force_authenticate(user=user)
    body = client.get('/api/me/assignments/').json()
    assert body['unitIds'] == ['own-dept']
    assert [t['unitId'] for t in body['tasks']] == ['own-dept']
    assert 'token' not in str(body).lower(), 'upload links are emailed, never listed'

    # An officer without a roster entry sees nothing rather than everything.
    stranger = User.objects.create_user(username='stranger', email='s@iitmandi.ac.in', password='x', role=NODAL)
    client.force_authenticate(user=stranger)
    assert client.get('/api/me/assignments/').json()['tasks'] == []

    # And the institute-wide list stays closed to them.
    assert client.get('/api/data-requests/').status_code == 403


@pytest.mark.django_db
def test_department_analytics_refuses_another_department():
    own = OrgUnit.objects.create(id='own-dept', name='Own Dept', type=OrgUnitType.ACADEMIC)
    OrgUnit.objects.create(id='other-dept', name='Other Dept', type=OrgUnitType.ACADEMIC)
    officer = NodalOfficer.objects.create(name='Head', email='head@iitmandi.ac.in', status=OfficerStatus.ACTIVE)
    officer.assigned_units.add(own)
    user = User.objects.create_user(username='head', email='head@iitmandi.ac.in', password='x', role=NODAL)
    client = APIClient()
    client.force_authenticate(user=user)

    assert client.get('/api/nirf/cycles/2026/department-analytics/?unitId=other-dept').status_code == 403
    mine = client.get('/api/nirf/cycles/2026/department-analytics/')
    assert mine.status_code == 200 and mine.data['scopedToUnits'] == ['own-dept']


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_login_accepts_email_and_reports_effective_role():
    User.objects.create_user(username='dora_officer', email='Officer@IITMandi.ac.in', password='Str0ng-pass!', role=AUDITOR)
    res = APIClient().post('/api/auth/token/', {'username': 'officer@iitmandi.ac.in', 'password': 'Str0ng-pass!'}, format='json')
    assert res.status_code == 200
    assert res.data['user']['role'] == AUDITOR

    User.objects.create_superuser(username='root', email='root@iitmandi.ac.in', password='Str0ng-pass!')
    res = APIClient().post('/api/auth/token/', {'username': 'root', 'password': 'Str0ng-pass!'}, format='json')
    assert res.data['user']['role'] == ADMIN, 'a superuser lands on the admin UI despite the default role'


@pytest.mark.django_db
def test_login_rejects_wrong_password_and_inactive_accounts():
    User.objects.create_user(username='u1', email='u1@iitmandi.ac.in', password='Str0ng-pass!', role=ADMIN)
    client = APIClient()
    assert client.post('/api/auth/token/', {'username': 'u1', 'password': 'wrong'}, format='json').status_code == 401
    User.objects.filter(username='u1').update(is_active=False)
    assert client.post('/api/auth/token/', {'username': 'u1', 'password': 'Str0ng-pass!'}, format='json').status_code == 401


@pytest.mark.django_db
def test_login_is_throttled():
    client = APIClient()
    codes = [
        client.post('/api/auth/token/', {'username': 'nobody', 'password': 'guess'}, format='json').status_code
        for _ in range(12)
    ]
    assert codes[0] == 401
    assert codes[-1] == 429


@pytest.mark.django_db
def test_is_staff_alone_does_not_grant_admin():
    user = User.objects.create_user(username='staffer', email='st@iitmandi.ac.in', password='x', role=DIRECTOR, is_staff=True)
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.post('/api/data-requests/', {}, format='json').status_code == 403


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_api(db):
    admin = User.objects.create_user(username='chief', email='chief@iitmandi.ac.in', password='x', role=ADMIN)
    client = APIClient()
    client.force_authenticate(user=admin)
    client.admin = admin
    return client


def test_admin_creates_user_with_role_who_can_then_log_in(admin_api):
    res = admin_api.post('/api/auth/users/', {
        'username': 'auditor1', 'email': 'auditor1@iitmandi.ac.in',
        'password': 'Audit-Trail-2026', 'role': AUDITOR, 'first_name': 'Ira',
    }, format='json')
    assert res.status_code == 201, res.data
    assert 'password' not in res.data
    login = APIClient().post('/api/auth/token/', {'username': 'auditor1@iitmandi.ac.in', 'password': 'Audit-Trail-2026'}, format='json')
    assert login.status_code == 200 and login.data['user']['role'] == AUDITOR


def test_user_management_rejects_weak_password_and_duplicate_email(admin_api):
    weak = admin_api.post('/api/auth/users/', {'username': 'w', 'email': 'w@iitmandi.ac.in', 'password': '123', 'role': NODAL}, format='json')
    assert weak.status_code == 400 and 'password' in weak.data
    dup = admin_api.post('/api/auth/users/', {'username': 'd', 'email': 'CHIEF@iitmandi.ac.in', 'password': 'Long-enough-pass-1', 'role': NODAL}, format='json')
    assert dup.status_code == 400 and 'email' in dup.data


def test_admin_cannot_demote_or_deactivate_self(admin_api):
    me = admin_api.admin.pk
    assert admin_api.patch(f'/api/auth/users/{me}/', {'role': DIRECTOR}, format='json').status_code == 400
    assert admin_api.patch(f'/api/auth/users/{me}/', {'isActive': False}, format='json').status_code == 400
    admin_api.admin.refresh_from_db()
    assert admin_api.admin.role == ADMIN and admin_api.admin.is_active


def test_admin_may_demote_another_admin(admin_api):
    other = User.objects.create_user(username='second', email='second@iitmandi.ac.in', password='x', role=ADMIN)
    res = admin_api.patch(f'/api/auth/users/{other.pk}/', {'role': AUDITOR}, format='json')
    assert res.status_code == 200 and res.data['role'] == AUDITOR


@pytest.mark.django_db
def test_last_active_admin_guard():
    """Defence in depth behind the self-demotion rule."""
    from apps.accounts.views import _active_admin_count
    only = User.objects.create_user(username='only', email='only@iitmandi.ac.in', password='x', role=ADMIN)
    User.objects.create_user(username='gone', email='gone@iitmandi.ac.in', password='x', role=ADMIN, is_active=False)
    assert _active_admin_count() == 1
    assert _active_admin_count(exclude_pk=only.pk) == 0


def test_users_are_deactivated_not_deleted(admin_api):
    target = User.objects.create_user(username='leaver', email='l@iitmandi.ac.in', password='x', role=NODAL)
    assert admin_api.delete(f'/api/auth/users/{target.pk}/').status_code == 405
    assert admin_api.patch(f'/api/auth/users/{target.pk}/', {'isActive': False}, format='json').status_code == 200
    assert APIClient().post('/api/auth/token/', {'username': 'leaver', 'password': 'x'}, format='json').status_code == 401


# ---------------------------------------------------------------------------
# Bootstrap admin
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_ensure_admin_is_idempotent_and_repairs_role(monkeypatch, settings):
    settings.DEBUG = False
    monkeypatch.setenv('DORA_ADMIN_USERNAME', 'opsadmin')
    monkeypatch.setenv('DORA_ADMIN_PASSWORD', 'Rotate-Me-2026!')
    call_command('ensure_admin', verbosity=0)
    user = User.objects.get(username='opsadmin')
    assert user.role == ADMIN and user.check_password('Rotate-Me-2026!')

    user.role = NODAL
    user.is_active = False
    user.save()
    monkeypatch.setenv('DORA_ADMIN_PASSWORD', 'Something-Else-1')
    call_command('ensure_admin', verbosity=0)
    user.refresh_from_db()
    assert user.role == ADMIN and user.is_active
    assert user.check_password('Rotate-Me-2026!'), 'password is kept unless --reset-password'


@pytest.mark.django_db
def test_ensure_admin_refuses_dev_password_in_production(monkeypatch, settings):
    from django.core.management.base import CommandError
    settings.DEBUG = False
    monkeypatch.delenv('DORA_ADMIN_PASSWORD', raising=False)
    with pytest.raises(CommandError):
        call_command('ensure_admin', verbosity=0)
    monkeypatch.setenv('DORA_ADMIN_PASSWORD', 'admin123')
    with pytest.raises(CommandError):
        call_command('ensure_admin', verbosity=0)
