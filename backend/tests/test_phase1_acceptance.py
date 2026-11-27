"""
Phase 1 acceptance criterion, verbatim from the proposal (section 5.1):

    "The system successfully generates a complete, compliant NIRF export based
    on mock data inputs, and the maker-checker audit trail correctly logs all
    data modifications."

One full mock cycle is run through the real endpoints - every section of all
four categories, entered by nodal officers, submitted, approved by a checker
and exported - and both halves of the criterion are checked against it.
"""

import hashlib
from io import BytesIO

import openpyxl
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.data_requests.models import PortalAccessGrant
from apps.submissions.demo_cycle import DEMO_DOMAIN, run_demo_cycle
from apps.submissions.models import (
    FormSchema,
    SectionSubmission,
    SubmissionAuditLog,
    SubmissionStatus,
)
from apps.submissions.rollup import compute_category_rollup


@pytest.fixture
def cycle(db):
    """
    Function-scoped on purpose: the cycle's rows (and its append-only audit
    entries) are rolled back after each test, so nothing leaks into the rest
    of the suite.
    """
    from django.core.management import call_command
    call_command('seed_organogram')
    call_command('load_form_schema')
    checker = get_user_model().objects.create_user(
        username='acceptance_checker', email='checker@iitmandi.ac.in', password='pw', role='ADMIN'
    )
    admin = APIClient()
    admin.force_authenticate(user=checker)
    result = run_demo_cycle(APIClient(), admin)
    schema = FormSchema.objects.filter(framework='NIRF', is_active=True).first().content
    return result, schema, checker


def _cells(workbook_bytes):
    ws = openpyxl.load_workbook(BytesIO(workbook_bytes)).active
    return [str(c.value) for row in ws.iter_rows() for c in row if c.value is not None]


def test_mock_cycle_runs_clean(cycle):
    result, schema, _ = cycle
    assert result['failures'] == [], result['failures']
    assert result['submitted'] == result['approved'] > 100
    assert set(result['exports']) == {c['id'] for c in schema['categories']}


# -- "a complete, compliant NIRF export" -------------------------------------

def test_export_is_complete_for_every_category(cycle):
    result, schema, _ = cycle
    sections = {s['id']: s for s in schema['sections']}
    for cat in schema['categories']:
        category = cat['id']
        rollup = compute_category_rollup(category, 2027, request_id=result['request'].id)
        assert rollup['coverageComplete'], f'{category}: an eligible unit or central owner is unapproved'

        cells = _cells(result['exports'][category])
        for sid in cat['sections']:
            sec = sections[sid]
            if sec.get('exportToNirf') is False:
                continue
            assert (sec.get('dcsHeading') or sec['title']) in cells, f'{sid} missing from {category}'
        assert 'No records reported.' not in cells, f'{category}: a records table is empty'
        assert not [c for c in cells if c.startswith('Row ')], f'{category}: a row lost its label'


def test_export_is_compliant_per_category(cycle):
    """Category-specific rows appear only where the DCS has them."""
    result, _, _ = cycle
    overall = _cells(result['exports']['OVERALL'])
    engineering = _cells(result['exports']['ENGINEERING'])
    innovation = _cells(result['exports']['INNOVATION'])

    assert 'Studios' in overall and 'Studios' not in engineering
    tech_transfer = 'Patents Commercialized & Technology Transferred'
    assert tech_transfer in innovation and tech_transfer not in overall


# -- "the maker-checker audit trail correctly logs all data modifications" ----

def test_every_return_has_a_complete_maker_checker_trail(cycle):
    result, _, checker = cycle
    subs = SectionSubmission.objects.filter(request=result['request'])
    assert subs.count() == result['submitted']
    for sub in subs:
        assert sub.status == SubmissionStatus.APPROVED
        actions = list(sub.audit_logs.order_by('timestamp').values_list('action', flat=True))
        for required in ('UPDATE', 'SUBMIT', 'APPROVE'):
            assert required in actions, f'{sub.section_id}/{sub.org_unit_id} lacks {required}: {actions}'
        assert actions.index('SUBMIT') < actions.index('APPROVE'), 'checker acts after maker'

        updates = sub.audit_logs.filter(action='UPDATE')
        assert all(u.actor_type == 'OFFICER' and u.actor_id and u.timestamp for u in updates)

        if sub.payload or sub.records.exists():
            # Data was entered, so the trail must carry the values themselves,
            # not merely that an edit happened.
            logged = any(u.delta.get('changeCount') or u.delta.get('records') for u in updates)
            assert logged, f'{sub.section_id}/{sub.org_unit_id}: entered data left no old/new values'
        else:
            # A "not applicable" return: nothing was modified (centres are
            # created N/A for programme sections), but the declaration the
            # checker approved is on record.
            assert sub.not_applicable
            assert sub.audit_logs.get(action='SUBMIT').delta['notApplicable'] is True

        approve = sub.audit_logs.get(action='APPROVE')
        assert approve.actor_type == 'ADMIN' and approve.actor_id == str(checker.id)
        assert approve.delta['fromStatus'] == SubmissionStatus.SUBMITTED
        assert approve.delta['toStatus'] == SubmissionStatus.APPROVED


def test_every_export_is_logged_with_its_fingerprint(cycle):
    result, _, _ = cycle
    logged = {
        log.delta['category']: log.delta['sha256']
        for log in SubmissionAuditLog.objects.filter(action='EXPORT', delta__kind='dcs-excel',
                                                     delta__requestId=result['request'].id)
    }
    for category, content in result['exports'].items():
        assert logged.get(category) == hashlib.sha256(content).hexdigest()


def test_mock_cycle_never_targets_real_officers(cycle):
    result, _, _ = cycle
    emails = set(PortalAccessGrant.objects.filter(request=result['request'])
                 .values_list('officer__email', flat=True))
    assert emails and all(e.endswith(f'@{DEMO_DOMAIN}') for e in emails)


def test_seed_demo_cycle_command_writes_four_workbooks(db, tmp_path, settings):
    from django.core.management import call_command
    from django.core.management.base import CommandError
    call_command('seed_organogram')
    call_command('load_form_schema')
    get_user_model().objects.create_user(username='demo_checker', email='dc@iitmandi.ac.in',
                                         password='pw', role='ADMIN')

    settings.DEBUG = False
    with pytest.raises(CommandError, match='DEBUG off'):
        call_command('seed_demo_cycle', '--checker', 'demo_checker', '--out', str(tmp_path))

    settings.DEBUG = True
    call_command('seed_demo_cycle', '--checker', 'demo_checker', '--out', str(tmp_path))
    written = sorted(p.name for p in tmp_path.iterdir())
    assert written == [f'NIRF_2027_{c}_DCS_DEMO.xlsx' for c in ('ENGINEERING', 'INNOVATION', 'OVERALL', 'SDG')]
