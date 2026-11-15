"""
Phase 2 analytics endpoints, against the proposal's Part D requirements.

  2.15 Executive ranking dashboards - selectable time range, parameter-wise
       breakdown, gap analysis against peers *and* own historical averages.
  2.16 Department-wise contribution/performance analytics, including a
       department head seeing only their own.
  2.17 Boardroom PDF briefing with submission statistics, discrepancies and
       scenario-based projections.
  2.18 Role-based access control over all of the above.
"""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.data_requests.models import DataRequest
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit
from apps.submissions.models import (
    FormSchema,
    SectionSubmission,
    SubmissionRecord,
    SubmissionStatus,
)

User = get_user_model()
PARAMS = ['tlr', 'rpc', 'go', 'oi', 'pr']


@pytest.fixture
def seeded(db):
    from django.core.management import call_command
    call_command('seed_organogram')
    call_command('load_form_schema')


def _user(role, username):
    return User.objects.create_user(
        username=username, email=f'{username}@iitmandi.ac.in', password='pw', role=role
    )


def _client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


# -----------------------------------------------------------------------------
# 2.15 Executive ranking dashboards
# -----------------------------------------------------------------------------

def test_parameter_trends_are_public_and_parameter_wise(db):
    res = _client().get('/api/v1/rankings/parameters/trends/?category=Engineering')
    assert res.status_code == 200
    body = res.json()

    series = body['trends']['Engineering']['series']
    assert len(series) >= 5, 'at least the five published cycles'

    latest = series[-1]
    assert set(latest['parameters']) == set(PARAMS)
    # Parameter-wise breakdown: each carries its weight and contribution.
    for key in PARAMS:
        cell = latest['parameters'][key]
        assert cell['value'] is not None
        assert cell['weightedContribution'] == pytest.approx(
            cell['value'] * cell['weight'], abs=0.01
        )
    # The parts reconcile to the published total.
    assert latest['recomposedScore'] == pytest.approx(latest['score'], abs=0.05)


def test_trend_range_is_selectable(db):
    c = _client()
    last3 = c.get('/api/v1/rankings/parameters/trends/?category=Engineering&last=3').json()
    assert len(last3['years']) == 3
    assert last3['years'] == sorted(last3['years'])

    bounded = c.get(
        '/api/v1/rankings/parameters/trends/?category=Engineering&from=2022&to=2024'
    ).json()
    assert bounded['years'] == [2022, 2023, 2024]

    assert c.get(
        '/api/v1/rankings/parameters/trends/?category=Engineering&last=0'
    ).status_code == 400
    assert c.get(
        '/api/v1/rankings/parameters/trends/?category=Innovation'
    ).status_code == 400, 'NIRF publishes no sub-scores for Innovation'


def test_gap_analysis_covers_peers_and_own_history(db):
    res = _client().get('/api/v1/rankings/gap-analysis/?category=Engineering&year=2025')
    assert res.status_code == 200
    entry = res.json()['analysis']['Engineering']

    peers = entry['vsPeers']
    assert peers['available'] is True
    assert peers['targetRank'] == 26, 'IIT Mandi, NIRF 2025 Engineering'
    assert len(peers['peers']) == 8, 'the 2nd-generation IIT cohort'
    # Weighted upside is the gap scaled by the parameter weight.
    for row in peers['parameters']:
        if row['gapToBest'] is not None and row['gapToBest'] > 0:
            assert row['weightedUpsideToBest'] == pytest.approx(
                row['gapToBest'] * row['weight'], abs=0.01
            )
    assert peers['priorities'] == sorted(
        peers['priorities'], key=lambda p: -p['weightedUpsideToBest']
    )

    own = entry['vsOwnHistory']
    assert own['available'] is True
    assert own['comparedAgainstYears'] == [2021, 2022, 2023, 2024]
    for row in own['parameters']:
        if row['historicalMean'] is not None:
            assert row['belowOwnAverage'] == (row['own'] < row['historicalMean'])


def test_gap_analysis_projections_are_labelled_scenarios(db):
    entry = _client().get(
        '/api/v1/rankings/gap-analysis/?category=Engineering&year=2025'
    ).json()['analysis']['Engineering']

    proj = entry['projections']
    assert proj['available'] is True
    assert 'scenario' in proj['disclaimer'].lower()
    assert 'not a predicted rank' in proj['disclaimer'].lower()

    for s in proj['scenarios']:
        assert s['projectedScore'] == pytest.approx(
            proj['baseScore'] + s['scoreDelta'], abs=0.01
        )
        # Closing a gap can only improve the standing.
        assert s['wouldHaveRanked'] <= entry['vsPeers']['targetRank']


# -----------------------------------------------------------------------------
# 2.16 Department-wise contribution & performance
# -----------------------------------------------------------------------------

@pytest.fixture
def cycle_with_department_data(seeded):
    """Two schools with real submitted values, so contributions are comparable."""
    req = DataRequest.objects.create(
        reference='P2-001', title='NIRF 2027 cycle', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline=timezone.now(), categories=['OVERALL'],
        data_item_ids=[],
    )
    schema = FormSchema.objects.filter(framework='NIRF', is_active=True).first()

    def submit(unit_id, section_id, payload):
        return SectionSubmission.objects.create(
            request=req, org_unit_id=unit_id, section_id=section_id,
            schema_version=schema.version, status=SubmissionStatus.APPROVED,
            payload=payload,
        )

    # SCEE: more funding, weaker placement rate.
    scee_reg = submit('scee', 'sponsored-project-register', {})
    for i, amount in enumerate([5_000_000, 3_000_000]):
        SubmissionRecord.objects.create(
            submission=scee_reg, block_id='projects', row_key=f'p{i}',
            data={'title': f'Project {i}', 'fundingAgency': 'DST',
                  'receivedFy0': amount, 'sanctionedAmountInr': amount * 2},
            position=i,
        )
    submit('scee', 'placement-outcomes', {
        'ug': {'UG4-2025': {'graduated': 100, 'placed': 60, 'higherStudies': 20}},
    })
    submit('scee', 'student-strength', {
        'UG4': {'male': 300, 'female': 100, 'total': 400},
    })

    # SBS: less funding, stronger placement rate.
    sbs_reg = submit('sbs', 'sponsored-project-register', {})
    SubmissionRecord.objects.create(
        submission=sbs_reg, block_id='projects', row_key='p0',
        data={'title': 'Bio project', 'fundingAgency': 'DBT',
              'receivedFy0': 1_000_000, 'sanctionedAmountInr': 2_000_000},
        position=0,
    )
    submit('sbs', 'placement-outcomes', {
        'ug': {'UG4-2025': {'graduated': 50, 'placed': 45, 'higherStudies': 3}},
    })
    submit('sbs', 'phd-details', {
        'graduated': {'fullTime': {'2025-26': 7}, 'partTime': {'2025-26': 2}},
    })
    return req


def test_department_contributions_rank_the_right_leaders(cycle_with_department_data):
    admin = _user('ADMIN', 'p2admin')
    res = _client(admin).get('/api/nirf/cycles/2027/department-analytics/')
    assert res.status_code == 200
    contrib = res.json()['contribution']

    by_unit = {d['unitId']: d for d in contrib['departments']}
    assert by_unit['scee']['researchFundingInr'] == 8_000_000
    assert by_unit['scee']['researchProjects'] == 2
    assert by_unit['sbs']['researchFundingInr'] == 1_000_000

    # Placement rate is placed/graduated, so SBS leads despite less funding.
    assert by_unit['scee']['placementRatePct'] == 60.0
    assert by_unit['sbs']['placementRatePct'] == 90.0
    assert by_unit['sbs']['phdGraduated'] == 9

    leaders = contrib['leaders']
    assert leaders['mostResearchFunding']['unitId'] == 'scee'
    assert leaders['highestPlacementRate']['unitId'] == 'sbs'
    assert leaders['mostPhdGraduated']['unitId'] == 'sbs'

    inst = contrib['institute']
    assert inst['totalResearchFundingInr'] == 9_000_000
    assert inst['totalGraduated'] == 150
    assert inst['institutePlacementRatePct'] == 70.0


def test_department_head_sees_only_their_own(cycle_with_department_data):
    """Spec 2.18: a nodal officer cannot view other departments' data."""
    officer_user = _user('NODAL_OFFICER', 'scee_head')
    officer = NodalOfficer.objects.create(
        name='SCEE Head', email=officer_user.email, status=OfficerStatus.ACTIVE
    )
    officer.assigned_units.add(OrgUnit.objects.get(id='scee'))

    res = _client(officer_user).get('/api/nirf/cycles/2027/department-analytics/')
    assert res.status_code == 200
    body = res.json()

    assert body['scopedToUnits'] == ['scee']
    units = {d['unitId'] for d in body['contribution']['departments']}
    assert units == {'scee'}, 'must not leak another school'
    # Institute league tables are withheld from a single-department view.
    assert 'leaders' not in body['contribution']
    assert 'leaderboard' not in body['performance']

    denied = _client(officer_user).get(
        '/api/nirf/cycles/2027/department-analytics/?unitId=sbs'
    )
    assert denied.status_code == 403


def test_department_analytics_requires_authentication(cycle_with_department_data):
    assert _client().get('/api/nirf/cycles/2027/department-analytics/').status_code in (401, 403)


def test_auditor_gets_read_only_institute_view(cycle_with_department_data):
    auditor = _user('AUDITOR', 'p2auditor')
    res = _client(auditor).get('/api/nirf/cycles/2027/department-analytics/')
    assert res.status_code == 200
    assert res.json()['scopedToUnits'] is None


# -----------------------------------------------------------------------------
# 2.17 Boardroom briefing
# -----------------------------------------------------------------------------

def test_briefing_renders_a_pdf(cycle_with_department_data):
    director = _user('DIRECTOR', 'p2director')
    res = _client(director).get(
        f'/api/nirf/cycles/2027/briefing/?requestId={cycle_with_department_data.id}'
    )
    assert res.status_code == 200
    assert res['Content-Type'] == 'application/pdf'
    assert res['Content-Disposition'].startswith('attachment;')
    body = res.content
    assert body.startswith(b'%PDF'), 'a real PDF, not an error page'
    assert len(body) > 10_000, 'a populated multi-page briefing'


def test_briefing_is_denied_to_a_nodal_officer(cycle_with_department_data):
    officer_user = _user('NODAL_OFFICER', 'p2officer')
    res = _client(officer_user).get('/api/nirf/cycles/2027/briefing/')
    assert res.status_code == 403
