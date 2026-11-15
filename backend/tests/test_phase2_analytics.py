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


def test_joint_projects_are_counted_once_for_the_institute(cycle_with_department_data):
    """Spec 2.7: a joint project in two registers is not double-counted."""
    req = cycle_with_department_data
    scee_reg = SectionSubmission.objects.get(request=req, org_unit_id='scee',
                                             section_id='sponsored-project-register')
    sbs_reg = SectionSubmission.objects.get(request=req, org_unit_id='sbs',
                                            section_id='sponsored-project-register')
    joint = {'title': 'Joint bio-sensing', 'fundingAgency': 'DST', 'sanctionOrderNo': 'DST/JNT/42',
             'receivedFy0': 2_000_000, 'sanctionedAmountInr': 4_000_000}
    for i, reg in enumerate((scee_reg, sbs_reg)):
        SubmissionRecord.objects.create(submission=reg, block_id='projects',
                                        row_key=f'joint{i}', data=dict(joint), position=9)

    admin = _user('ADMIN', 'joint_admin')
    contrib = _client(admin).get('/api/nirf/cycles/2027/department-analytics/').json()['contribution']
    by_unit = {d['unitId']: d for d in contrib['departments']}
    inst = contrib['institute']

    # Each unit keeps the credit for the joint grant...
    assert by_unit['scee']['researchFundingInr'] == 10_000_000
    assert by_unit['sbs']['researchFundingInr'] == 3_000_000
    # ...but the institute counts it once: 8M + 1M + 2M, not 8M + 1M + 2M + 2M.
    assert inst['totalResearchFundingInr'] == 11_000_000
    assert inst['creditedResearchFundingInr'] == 13_000_000
    assert inst['jointProjects'] == 1 and inst['jointProjectFundingInr'] == 2_000_000
    assert inst['totalResearchProjects'] == 4
    assert round(sum(d['fundingSharePct'] for d in contrib['departments']), 0) == 100


def _approve_register(req, unit_id, amount, graduated=40, placed=30):
    schema = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
    reg = SectionSubmission.objects.create(
        request=req, org_unit_id=unit_id, section_id='sponsored-project-register',
        schema_version=schema.version, status=SubmissionStatus.APPROVED, payload={},
    )
    SubmissionRecord.objects.create(submission=reg, block_id='projects', row_key=f'{unit_id}-p',
                                    data={'title': f'{unit_id} grant', 'fundingAgency': 'SERB',
                                          'receivedFy0': amount}, position=1)
    SectionSubmission.objects.create(
        request=req, org_unit_id=unit_id, section_id='placement-outcomes',
        schema_version=schema.version, status=SubmissionStatus.APPROVED,
        payload={'ug': {'UG4-2025': {'graduated': graduated, 'placed': placed}}},
    )


def _head_of(unit_id, username):
    user = _user('NODAL_OFFICER', username)
    officer = NodalOfficer.objects.create(name=f'{unit_id} head', email=user.email,
                                          status=OfficerStatus.ACTIVE)
    officer.assigned_units.add(OrgUnit.objects.get(id=unit_id))
    return _client(user)


def test_department_head_benchmark_is_withheld_with_too_few_peers(cycle_with_department_data):
    """Two reporting units: a median would expose the only peer's figures."""
    body = _head_of('scee', 'scee_head_few').get('/api/nirf/cycles/2027/department-analytics/').json()
    assert body['benchmark']['withheld'] is True


def test_department_head_gets_anonymous_medians_with_enough_peers(cycle_with_department_data):
    req = cycle_with_department_data
    for unit_id, amount in (('scene', 2_000_000), ('smss', 500_000), ('som', 4_000_000)):
        _approve_register(req, unit_id, amount)

    res = _head_of('scee', 'scee_head_many').get('/api/nirf/cycles/2027/department-analytics/')
    body = res.json()
    bench = body['benchmark']
    assert bench['withheld'] is False and bench['unitsCompared'] == 5
    # Funding across the five units: 8M, 1M, 2M, 0.5M, 4M -> median 2M.
    assert bench['medianResearchFundingInr'] == 2_000_000
    assert bench['medianPlacementRatePct'] is not None

    # No other unit is named anywhere in a department head's response.
    raw = res.content.decode()
    for other in ('"sbs"', '"scene"', '"smss"', '"som"'):
        assert other not in raw, f'{other} leaked into a scoped response'
