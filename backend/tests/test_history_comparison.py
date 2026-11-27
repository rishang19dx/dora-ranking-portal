"""
Historical value comparison during entry and review (spec 2.6).

"Real-time contextual display of historically submitted values alongside new
data entries (e.g. Previous: X, New: Y, Change: Increase/Decrease)."
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.data_requests.models import DataRequest, DataRequestTarget
from apps.data_requests.services import issue_grant
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit
from apps.submissions.history import (
    change_between,
    notable_changes,
    prior_period,
    section_history,
    unit_history,
)
from apps.submissions.models import SectionSubmission, SubmissionRecord, SubmissionStatus

User = get_user_model()
SECTION = 'sponsored-research'
UNIT = 'sponsored-research'  # the central owner unit of this section


def test_prior_period_shifts_academic_and_calendar_years():
    assert prior_period('2025-26') == '2024-25'
    assert prior_period('2000-01') == '1999-00'
    assert prior_period('2025') == '2024'
    assert prior_period('projects') is None


def test_change_between_reports_direction_and_percent():
    assert change_between(100, 120) == {'change': 20.0, 'changePct': 20.0, 'direction': 'up'}
    assert change_between('1,00,000', '50000')['direction'] == 'down'
    assert change_between(0, 5)['changePct'] is None, 'no percentage against zero'
    assert change_between('n/a', 5)['direction'] is None


@pytest.fixture
def cycles(db):
    call_command('seed_organogram', verbosity=0)
    call_command('load_form_schema', verbosity=0)
    unit = OrgUnit.objects.get(id=UNIT)

    def make(year, status, payload):
        req = DataRequest.objects.create(
            reference=f'DORA/{year}/NIRF/H', title=f'NIRF {year}', framework='NIRF', cycle_year=year,
            subject='s', message='m', deadline=timezone.now() + timedelta(days=20), data_item_ids=[],
        )
        DataRequestTarget.objects.create(request=req, org_unit=unit, data_item_ids=['sponsored-projects'])
        return SectionSubmission.objects.create(
            request=req, org_unit=unit, section_id=SECTION, schema_version='1.0.0',
            status=status, payload=payload, reviewed_at=timezone.now(),
        )

    old = make(2025, SubmissionStatus.APPROVED, {'sponsored': {
        'projects': {'2023-24': 30, '2022-23': 25, '2021-22': 20},
    }})
    prev = make(2026, SubmissionStatus.APPROVED, {'sponsored': {
        'projects': {'2024-25': 40, '2023-24': 30, '2022-23': 25},
        'amountReceived': {'2024-25': 1000000, '2023-24': 800000, '2022-23': 600000},
    }})
    # A newer draft from the same earlier cycle must never be the baseline.
    make_draft = SectionSubmission.objects.create(
        request=prev.request, org_unit=unit, section_id='capital-expenditure',
        schema_version='1.0.0', status=SubmissionStatus.DRAFT, payload={},
    )
    current = make(2027, SubmissionStatus.DRAFT, {'sponsored': {
        'projects': {'2025-26': 10, '2024-25': 44, '2023-24': 30},
        'amountReceived': {'2025-26': 1100000},
    }})
    return {'old': old, 'prev': prev, 'current': current, 'draft': make_draft, 'unit': unit}


def test_baseline_is_latest_earlier_approved_return(cycles):
    history = section_history(cycles['current'])
    assert history['previousCycle'] == 2026
    assert history['previousReference'] == 'DORA/2026/NIRF/H'


def test_overlapping_period_is_compared_as_a_restatement(cycles):
    cells = section_history(cycles['current'])['cells']['sponsored']['projects']
    restated = cells['2024-25']
    assert restated['basis'] == 'same-period' and restated['period'] == '2024-25'
    assert restated['previous'] == 40 and restated['change'] == 4.0
    assert restated['restated'] is True
    unchanged = cells['2023-24']
    assert unchanged['direction'] == 'same' and unchanged['restated'] is False


def test_new_year_is_compared_with_the_prior_year(cycles):
    cells = section_history(cycles['current'])['cells']['sponsored']
    yoy = cells['projects']['2025-26']
    assert yoy['basis'] == 'prior-period' and yoy['period'] == '2024-25'
    assert yoy['previous'] == 40 and yoy['changePct'] == -75.0 and yoy['direction'] == 'down'
    assert cells['amountReceived']['2025-26']['changePct'] == 10.0


def test_empty_cells_get_their_previous_value_when_schema_is_given(cycles):
    from apps.submissions.models import FormSchema
    from apps.submissions.views import resolve_section_schema
    schema = FormSchema.objects.filter(is_active=True).first().content
    sec = next(s for s in schema['sections'] if s['id'] == SECTION)
    resolved = resolve_section_schema(sec, 2027, unit=cycles['unit'], enums=schema.get('enums', {}))
    cells = section_history(cycles['current'], resolved_section=resolved)['cells']['sponsored']
    # amountReceived 2024-25 has not been typed in the 2027 draft yet.
    hint = cells['amountReceived']['2024-25']
    assert hint['previous'] == 1000000 and hint['direction'] is None and hint['restated'] is False


def test_notable_changes_list_restatements_and_big_moves(cycles):
    notable = notable_changes(section_history(cycles['current']))
    keys = {(n['rowKey'], n['colKey']) for n in notable}
    assert ('projects', '2024-25') in keys, 'restated period'
    assert ('projects', '2025-26') in keys, '-75% year on year'
    assert ('amountReceived', '2025-26') not in keys, '+10% is within the threshold'


def test_no_history_without_an_approved_earlier_return(cycles):
    assert section_history(cycles['old']) is None
    cycles['prev'].status = SubmissionStatus.SUBMITTED
    cycles['prev'].save()
    assert section_history(cycles['current'])['previousCycle'] == 2025, 'falls back past the unapproved one'


def test_record_counts_are_compared(cycles):
    SubmissionRecord.objects.create(submission=cycles['prev'], block_id='projectRegister', unit_id=UNIT,
                                    row_key='a', data={'x': 1}, position=0)
    SubmissionRecord.objects.create(submission=cycles['prev'], block_id='projectRegister', unit_id=UNIT,
                                    row_key='b', data={'x': 2}, position=1)
    history = section_history(cycles['current'], current_records={'projectRegister': [{'x': 1}]})
    assert history['records']['projectRegister'] == {
        'previous': 2, 'previousCycle': 2026, 'change': -1.0, 'changePct': -50.0, 'direction': 'down',
    }


def test_unit_history_returns_last_cycles_oldest_first(cycles):
    rows = unit_history(UNIT, SECTION, cycles=3)
    assert [r['cycleYear'] for r in rows] == [2025, 2026]
    assert unit_history(UNIT, SECTION, before_cycle=2026)[0]['cycleYear'] == 2025


def test_unit_history_3_year_baseline_excludes_unapproved(cycles):
    unit = cycles['unit']
    for year, status in ((2023, SubmissionStatus.SUBMITTED), (2024, SubmissionStatus.APPROVED)):
        req = DataRequest.objects.create(
            reference=f'DORA/{year}/NIRF/H3',
            title=f'NIRF {year}',
            framework='NIRF',
            cycle_year=year,
            subject='s',
            message='m',
            deadline=timezone.now() + timedelta(days=20),
            data_item_ids=[],
        )
        SectionSubmission.objects.create(
            request=req,
            org_unit=unit,
            section_id=SECTION,
            schema_version='1.0.0',
            status=status,
            payload={'sponsored': {'projects': {f'{year - 2}-{str(year - 1)[-2:]}': year - 2000}}},
            reviewed_at=timezone.now(),
        )

    rows = unit_history(UNIT, SECTION, before_cycle=2027, cycles=3)
    assert [r['cycleYear'] for r in rows] == [2024, 2025, 2026]


def test_history_api_is_oversight_only(cycles):
    auditor = User.objects.create_user(username='aud', email='aud@iitmandi.ac.in', password='x', role='AUDITOR')
    client = APIClient()
    client.force_authenticate(user=auditor)
    res = client.get(f'/api/nirf/history/?unitId={UNIT}&sectionId={SECTION}&cycles=5')
    assert res.status_code == 200
    assert [c['cycleYear'] for c in res.json()['cycles']] == [2025, 2026]
    assert client.get('/api/nirf/history/?unitId=x').status_code == 400


def test_portal_form_carries_history_for_the_officer(cycles):
    officer = NodalOfficer.objects.create(name='SRIC', email='sric@iitmandi.ac.in', status=OfficerStatus.ACTIVE)
    officer.assigned_units.add(cycles['unit'])
    _grant, token, _url = issue_grant(cycles['current'].request, cycles['unit'], officer, ['sponsored-projects'])

    body = APIClient().get(f'/api/portal/{token}/forms/').json()
    entry = next(s for s in body['sections'] if s['section']['id'] == SECTION)
    history = entry['history']
    assert history['previousCycle'] == 2026
    assert history['cells']['sponsored']['projects']['2025-26']['previous'] == 40


def test_reviewer_sees_history_and_notable_changes(cycles):
    admin = User.objects.create_user(username='adm', email='adm@iitmandi.ac.in', password='x', role='ADMIN')
    client = APIClient()
    client.force_authenticate(user=admin)
    body = client.get(f"/api/submissions/{cycles['current'].id}/").json()
    assert body['history']['previousCycle'] == 2026
    assert any(n['colKey'] == '2025-26' and n['rowKey'] == 'projects' for n in body['notableChanges'])


def test_cross_checks_accept_row_keyed_grids(db):
    """Regression: the form stores grids keyed by row id; cross-checks assumed lists and crashed the review screen."""
    from apps.submissions.cross_checks import _grid_rows
    rows = _grid_rows({'2024-25': {'landAreaAcres': 500}, '2025-26': {'landAreaAcres': 530}})
    assert rows[0] == {'id': '2025-26', 'landAreaAcres': 530}, 'newest year first'
    assert _grid_rows([{'id': 'x'}, 'junk']) == [{'id': 'x'}]
    assert _grid_rows(None) == []
