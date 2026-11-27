"""
Public ranking portal across systems (spec 2.14; Phase 3 acceptance: "public
portal is accessible without authentication and accurately plots dummy
historical data").
"""
import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient

from apps.rankings.models import ExternalRankingResult, parse_rank

User = get_user_model()


@pytest.mark.parametrize('text,expected', [
    ('26', (26, 26)), ('=451', (451, 451)), ('Joint 12', (12, 12)),
    ('801-1000', (801, 1000)), ('801 – 1000', (801, 1000)), ('601 to 800', (601, 800)), ('1001+', (1001, None)),
])
def test_parse_rank(text, expected):
    assert parse_rank(text) == expected


@pytest.mark.parametrize('bad', ['', 'top 100', '1000-801', 'n/a'])
def test_parse_rank_rejects(bad):
    with pytest.raises(ValueError):
        parse_rank(bad)


def test_public_endpoint_needs_no_login_and_includes_real_nirf(db, ranking_data_files):
    body = APIClient().get('/api/v1/public/ranking-systems/').json()
    nirf = {s['id']: s for s in body['systems'] if s['family'] == 'NIRF'}
    assert set(nirf) == {'NIRF_OVERALL', 'NIRF_ENGINEERING', 'NIRF_INNOVATION'}
    eng = nirf['NIRF_ENGINEERING']['series']
    assert [p['year'] for p in eng] == [2021, 2022, 2023, 2024, 2025]
    assert eng[-1]['rankText'] == '35' and eng[-1]['plotRank'] == 35
    assert body['lowerIsBetter'] is True and body['hasDemoData'] is False


def test_demo_seed_plots_exactly_what_was_seeded(db, ranking_data_files):
    call_command('seed_demo_rankings', '--force', verbosity=0)
    body = APIClient().get('/api/v1/public/ranking-systems/').json()
    assert body['hasDemoData'] is True
    qs = next(s for s in body['systems'] if s['id'] == 'QS_WORLD')
    assert qs['label'] == 'QS World University Rankings'
    first, last = qs['series'][0], qs['series'][-1]
    assert (first['year'], first['rankText'], first['plotRank']) == (2022, '801-1000', 900.5)
    assert (last['year'], last['rankLow'], last['rankHigh']) == (2026, 601, 650)
    assert all(p['demo'] for p in qs['series'])


def test_demo_seed_never_overwrites_real_entries_and_clears(db, settings):
    ExternalRankingResult.objects.create(system='QS_WORLD', year=2026, rank_text='555')
    settings.DEBUG = True
    call_command('seed_demo_rankings', verbosity=0)
    assert ExternalRankingResult.objects.get(system='QS_WORLD', year=2026).rank_text == '555'
    call_command('seed_demo_rankings', '--clear', verbosity=0)
    assert list(ExternalRankingResult.objects.values_list('rank_text', flat=True)) == ['555']

    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command('seed_demo_rankings', verbosity=0)


def test_unpublished_results_stay_off_the_public_portal(db):
    ExternalRankingResult.objects.create(system='THE_WORLD', year=2026, rank_text='401-500', published=False)
    body = APIClient().get('/api/v1/public/ranking-systems/').json()
    assert not any(s['id'] == 'THE_WORLD' for s in body['systems'])


@pytest.fixture
def admin_api(db):
    client = APIClient()
    client.force_authenticate(user=User.objects.create_user(username='a', email='a@iitmandi.ac.in', password='x', role='ADMIN'))
    return client


def test_admin_enters_validates_and_edits_results(admin_api):
    res = admin_api.post('/api/rankings/external/', {
        'system': 'THE_ASIA', 'year': 2026, 'rankText': '98', 'score': 41.2,
        'source': 'https://www.timeshighereducation.com/',
    }, format='json')
    assert res.status_code == 201, res.data
    assert res.data['rankLow'] == 98 and res.data['demo'] is False

    dup = admin_api.post('/api/rankings/external/', {'system': 'THE_ASIA', 'year': 2026, 'rankText': '99'}, format='json')
    assert dup.status_code == 400 and 'year' in dup.data

    bad = admin_api.post('/api/rankings/external/', {
        'system': 'OTHER', 'year': 1990, 'rankText': 'top ten', 'source': 'ftp://x',
    }, format='json')
    assert set(bad.data) == {'systemLabel', 'year', 'rankText', 'source'}

    edited = admin_api.patch(f"/api/rankings/external/{res.data['id']}/", {'rankText': '91-100', 'published': False}, format='json')
    assert edited.data['rankHigh'] == 100 and edited.data['published'] is False
    assert admin_api.delete(f"/api/rankings/external/{res.data['id']}/").status_code == 204


def test_editing_a_demo_row_makes_it_real(admin_api, db):
    call_command('seed_demo_rankings', '--force', verbosity=0)
    row = ExternalRankingResult.objects.get(system='QS_ASIA', year=2026)
    admin_api.patch(f'/api/rankings/external/{row.id}/', {'rankText': '150'}, format='json')
    row.refresh_from_db()
    assert row.is_demo is False and row.rank_text == '150'


def test_other_system_needs_a_name(admin_api):
    res = admin_api.post('/api/rankings/external/', {
        'system': 'OTHER', 'systemLabel': 'ARWU', 'year': 2025, 'rankText': '901-1000',
    }, format='json')
    assert res.status_code == 201 and res.data['label'] == 'ARWU'


def test_hiding_a_demo_row_keeps_it_marked_demo(admin_api):
    call_command('seed_demo_rankings', '--force', verbosity=0)
    row = ExternalRankingResult.objects.get(system='QS_ASIA', year=2025)
    admin_api.patch(f'/api/rankings/external/{row.id}/', {'published': False}, format='json')
    row.refresh_from_db()
    assert row.is_demo is True and row.published is False
