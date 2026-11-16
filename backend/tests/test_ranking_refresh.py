"""
Newly published NIRF cycles are picked up automatically.

The proposal asks for "automated fetching and visualization of year-wise
ranking trends" (2.14). These tests simulate NIRF publishing a new cycle and
check that it is fetched, becomes the latest year everywhere without a code
change or restart, and that the explicit fetch button is staff-only.

The NIRF site is mocked and the data directory is a temporary copy, so
nothing in the repository is touched.
"""

import json
import os
import shutil
from datetime import date
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.rankings import scraper, store

REAL_DATA = os.path.join(os.path.dirname(scraper.__file__), 'data')


def _nirf_page(rows):
    """A results page in NIRF's real layout: sub-scores in a nested table."""
    body = ''
    for iid, name, score, rank, params in rows:
        nested = (
            '<table class="table"><tr><th>TLR (100)</th><th>RPC (100)</th><th>GO (100)</th>'
            '<th>OI (100)</th><th>PERCEPTION (100)</th></tr><tr>'
            + ''.join(f'<td>{v}</td>' for v in params) + '</tr></table>'
        )
        body += (f'<tr><td>{iid}</td><td>{name}<br/>More Details{nested}</td>'
                 f'<td>City</td><td>State</td><td>{score}</td><td>{rank}</td></tr>')
    return f'<html><table id="tbl_overall"><tbody>{body}</tbody></table></html>'.encode()


ENGINEERING_2026 = _nirf_page([
    ('IR-E-U-0456', 'Indian Institute of Technology Madras', 89.1, 1, (96, 91, 83, 64, 100)),
    ('IR-E-U-0184', 'Indian Institute of Technology Mandi', 64.2, 22, (83, 46, 79, 69, 23)),
    ('IR-E-U-0273', 'Indian Institute of Technology Indore', 66.0, 18, (80, 58, 78, 66, 25)),
])


class _Resp:
    def __init__(self, status, content=b''):
        self.status_code, self.content = status, content


def _published(only):
    """requests.get stub: `only` maps (year, category) -> page; the rest 404."""
    def fake_get(url, headers=None, timeout=None):
        for (year, category), page in only.items():
            if f'/{year}/{category}Ranking.html' in url:
                return _Resp(200, page)
        return _Resp(404)
    return fake_get


@pytest.fixture
def data_dir(tmp_path):
    target = tmp_path / 'data'
    shutil.copytree(REAL_DATA, target)
    with patch.object(scraper, 'DATA_DIR', str(target)), \
         patch.object(scraper, 'CUSTOM_API_DATA_DIR', str(tmp_path / 'absent')):
        yield target


def test_refresh_fetches_a_newly_published_cycle(data_dir):
    assert store.latest_year('Engineering') == 2025
    report = {}
    with patch.object(scraper.requests, 'get', _published({(2026, 'Engineering'): ENGINEERING_2026})):
        ok = scraper.refresh_new_publications(today=date(2026, 9, 15), report=report)

    assert ok is True
    assert report['fetched'] == [(2026, 'Engineering', 3)]
    # Overall and Innovation 2026 are not out yet: pending, not a failure.
    assert {(2026, 'Overall'), (2026, 'Innovation')} <= set(report['unpublished'])
    assert report['failed'] == []

    assert store.latest_year('Engineering') == 2026
    mandi = next(r for r in store.load_ranking_data(2026, 'engineering') if 'Mandi' in r['name'])
    assert mandi['rank'] == 22 and mandi['parameters']['rpc'] == 46.0


def test_cached_cycles_are_never_refetched(data_dir):
    calls = []

    def counting_get(url, **kw):
        calls.append(url)
        return _Resp(404)

    with patch.object(scraper.requests, 'get', counting_get):
        scraper.refresh_new_publications(today=date(2026, 9, 15))
    # Only the three 2026 tables are requested; 2021-2025 are already cached.
    assert len(calls) == 3 and all('/2026/' in u for u in calls)


def test_no_invented_rows_in_a_new_innovation_cycle(data_dir):
    short_innovation = _nirf_page([
        ('IR-I-1', 'Indian Institute of Technology Madras', 90, 1, (1, 1, 1, 1, 1)),
    ])
    with patch.object(scraper.requests, 'get', _published({(2026, 'Innovation'): short_innovation})):
        scraper.refresh_new_publications(today=date(2026, 9, 15))
    names = [r['name'] for r in store.load_ranking_data(2026, 'innovation')]
    assert names == ['Indian Institute of Technology Madras'], 'only what NIRF published'


def test_a_new_file_is_seen_without_clearing_any_cache(data_dir):
    """Every worker reads a newly written year - the cache keys on mtime."""
    assert store.load_ranking_data(2026, 'overall') is None  # a cached "not found"
    with open(data_dir / 'nirf_2026_overall.json', 'w') as fh:
        json.dump([{'name': 'X', 'rank': 1, 'score': 50}], fh)
    assert store.load_ranking_data(2026, 'overall')[0]['name'] == 'X'


def test_writes_are_atomic(data_dir):
    with patch.object(scraper.requests, 'get', _published({(2026, 'Engineering'): ENGINEERING_2026})):
        scraper.refresh_new_publications(today=date(2026, 9, 15))
    assert not [n for n in os.listdir(data_dir) if n.startswith('.tmp-')]


def test_dashboards_follow_the_new_latest_year(db, data_dir):
    with patch.object(scraper.requests, 'get', _published({(2026, 'Engineering'): ENGINEERING_2026})):
        scraper.refresh_new_publications(today=date(2026, 9, 15))
    c = APIClient()

    gap = c.get('/api/v1/rankings/gap-analysis/?category=Engineering').json()
    assert gap['year'] == 2026
    assert gap['analysis']['Engineering']['vsPeers']['targetRank'] == 22

    trends = c.get('/api/v1/rankings/trends/?category=Engineering').json()
    assert trends['years'][-1] == 2026 and trends['latestYear'] == 2026
    assert trends['years'] == sorted(trends['years']) and len(trends['years']) == 5

    params = c.get('/api/v1/rankings/parameters/trends/?category=Engineering').json()
    assert params['years'][-1] == 2026


# -- the explicit fetch button ------------------------------------------------

def _client(role=None, username='u'):
    c = APIClient()
    if role:
        user = get_user_model().objects.create_user(
            username=username, email=f'{username}@iitmandi.ac.in', password='pw', role=role)
        c.force_authenticate(user=user)
    return c


def test_fetch_button_is_staff_only(db, data_dir):
    with patch.object(scraper.requests, 'get', _published({})):
        assert _client().post('/api/v1/scraper/update/').status_code in (401, 403)
        assert _client('NODAL_OFFICER', 'officer').post('/api/v1/scraper/update/').status_code == 403
        assert _client('AUDITOR', 'auditor').post('/api/v1/scraper/update/').status_code == 403
        # Director is read-only (spec 2.18), so cannot trigger ingestion either.
        assert _client('DIRECTOR', 'director').post('/api/v1/scraper/update/').status_code == 403


def test_fetch_button_reports_what_it_found(db, data_dir):
    admin = _client('ADMIN', 'fetch_admin')
    with patch.object(scraper.requests, 'get', _published({})):
        nothing = admin.post('/api/v1/scraper/update/').json()
    assert nothing['mode'] == 'new-only' and nothing['fetched'] == []
    assert 'Already up to date' in nothing['message']

    with patch.object(scraper.requests, 'get', _published({(2026, 'Engineering'): ENGINEERING_2026})):
        res = admin.post('/api/v1/scraper/update/')
    body = res.json()
    assert res.status_code == 200
    assert body['fetched'] == [{'year': 2026, 'category': 'Engineering', 'institutions': 3}]
    assert body['latestYear'] == 2026 and body['message'] == 'Fetched NIRF 2026.'


def test_concurrent_fetches_are_refused(db, data_dir):
    admin = _client('ADMIN', 'lock_admin')
    with scraper.fetch_lock() as held:
        assert held
        res = admin.post('/api/v1/scraper/update/')
    assert res.status_code == 409


def test_unreachable_site_is_a_failure_not_a_crash(db, data_dir):
    def down(url, **kw):
        raise scraper.requests.ConnectionError('NIRF unreachable')

    with patch.object(scraper.requests, 'get', down):
        res = _client('ADMIN', 'down_admin').post('/api/v1/scraper/update/')
    assert res.status_code == 502
    assert res.json()['failed'] and 'Could not reach' in res.json()['message']
