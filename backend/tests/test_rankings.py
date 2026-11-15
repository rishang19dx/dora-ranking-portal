"""
Tests for apps.rankings — scraper utilities and ranking API views.
"""
import pytest

from apps.rankings.scraper import (
    TARGET_IITS,
    canonical_iit_name,
    clean_institute_name,
    get_fallback_innovation_data,
)

# ===========================================================================
# Scraper function unit tests (no DB needed)
# ===========================================================================

class TestCleanInstituteName:

    def test_clean_institute_name_basic(self):
        result = clean_institute_name('Indian Institute of Technology, Mandi')
        assert result == 'Indian Institute of Technology Mandi'

    def test_clean_institute_name_strips_more_details(self):
        result = clean_institute_name('IIT Mandi More Details...')
        assert result == 'IIT Mandi'

    def test_clean_institute_name_empty_string(self):
        assert clean_institute_name('') == ''

    def test_clean_institute_name_multiline(self):
        raw = '\n\n  Indian Institute of Technology Mandi  \nMore Details\nSome extra line\n'
        result = clean_institute_name(raw)
        assert result == 'Indian Institute of Technology Mandi'

    def test_clean_institute_name_with_close_delimiter(self):
        raw = 'Some Institute Close Extra'
        result = clean_institute_name(raw)
        assert 'Close' not in result


class TestCanonicalIITName:

    def test_canonical_iit_name_mandi(self):
        name = 'Indian Institute of Technology Mandi'
        result = canonical_iit_name(name)
        assert result == 'Indian Institute of Technology Mandi'

    def test_canonical_iit_name_no_match(self):
        name = 'University of Delhi'
        assert canonical_iit_name(name) == name

    def test_canonical_iit_name_iit_mandi_variant(self):
        result = canonical_iit_name('IIT Mandi')
        assert result == 'Indian Institute of Technology Mandi'

    def test_canonical_iit_name_hyderabad(self):
        result = canonical_iit_name('Indian Institute of Technology Hyderabad')
        assert result == 'Indian Institute of Technology Hyderabad'

    def test_canonical_iit_name_indore_variant(self):
        result = canonical_iit_name('IIT Indore')
        assert result == 'Indian Institute of Technology Indore'


class TestGetFallbackInnovationData:

    def test_get_fallback_innovation_data_2021(self):
        data = get_fallback_innovation_data(2021)
        assert isinstance(data, list)
        assert len(data) > 0
        names = [d['name'] for d in data]
        assert 'Indian Institute of Technology Mandi' in names

    def test_get_fallback_innovation_data_2022(self):
        data = get_fallback_innovation_data(2022)
        assert isinstance(data, list)
        assert len(data) > 0
        names = [d['name'] for d in data]
        assert 'Indian Institute of Technology Mandi' in names

    def test_get_fallback_innovation_data_other_year(self):
        data = get_fallback_innovation_data(2019)
        assert data == []

    def test_fallback_data_2021_has_required_keys(self):
        data = get_fallback_innovation_data(2021)
        required_keys = {'institute_id', 'name', 'city', 'state', 'score', 'rank'}
        for item in data:
            assert required_keys.issubset(set(item.keys())), (
                f"Item missing keys: {required_keys - set(item.keys())}"
            )


# ===========================================================================
# API/View tests (require ranking_data_files fixture)
# ===========================================================================

@pytest.mark.django_db
class TestRankingsAPI:

    def test_ranking_root_welcome(self, api_client):
        response = api_client.get('/')
        assert response.status_code == 200
        assert 'endpoints' in response.data
        assert isinstance(response.data['endpoints'], list)
        assert len(response.data['endpoints']) > 0

    def test_get_rankings_valid(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/2024/overall/')
        assert response.status_code == 200
        assert 'count' in response.data
        assert 'data' in response.data

    def test_get_rankings_not_found(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/1990/overall/')
        assert response.status_code == 404

    def test_get_rankings_invalid_year(self, api_client, ranking_data_files):
        """Year 'abc' causes int(year) to raise ValueError → 400."""
        response = api_client.get('/api/v1/rankings/abc/overall/')
        assert response.status_code == 400

    def test_get_rankings_state_filter(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/2024/overall/?state=Himachal Pradesh')
        assert response.status_code == 200
        for item in response.data['data']:
            assert 'himachal pradesh' in item['state'].lower()

    def test_get_rankings_limit_filter(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/2024/overall/?limit=1')
        assert response.status_code == 200
        assert len(response.data['data']) <= 1

    def test_get_second_gen_iits(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/2024/engineering/2nd-gen-iits/')
        assert response.status_code == 200
        assert 'count' in response.data
        # All returned items should be 2nd gen IITs
        for item in response.data['data']:
            assert item['canonical_name'] in TARGET_IITS

    def test_get_ranking_by_rank_found(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/2024/overall/1/')
        assert response.status_code == 200
        assert response.data.get('rank') == 1

    def test_get_ranking_by_rank_not_found(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/2024/overall/9999/')
        assert response.status_code == 404

    def test_trends_analytics_returns_data(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/trends/')
        assert response.status_code == 200
        assert 'iit_mandi_trends' in response.data
        assert 'peer_comparison' in response.data

    def test_trends_analytics_category_filter(self, api_client, ranking_data_files):
        response = api_client.get('/api/v1/rankings/trends/?category=engineering')
        assert response.status_code == 200
        # When filtered, only Engineering key should be present in iit_mandi_trends
        trends = response.data['iit_mandi_trends']
        assert 'Engineering' in trends
        assert 'Overall' not in trends
        assert 'Innovation' not in trends

    def test_trends_analytics_calculates_rank_change(self, api_client, ranking_data_files):
        """rank_change is computed as prev_rank - current_rank (positive = improvement)."""
        response = api_client.get('/api/v1/rankings/trends/')
        assert response.status_code == 200
        for cat, yearly_data in response.data['iit_mandi_trends'].items():
            for entry in yearly_data:
                assert 'rank_change' in entry
                # First entry has no previous, rank_change = 0
                if entry.get('previous_rank') is None:
                    assert entry['rank_change'] == 0
                else:
                    # rank_change = previous_rank - current_rank
                    prev = entry.get('previous_rank')
                    curr = entry.get('rank')
                    if isinstance(prev, (int, float)) and isinstance(curr, (int, float)):
                        assert entry['rank_change'] == prev - curr

    def test_lru_cache_cleared_between_tests(self, ranking_data_files):
        """Verify that cache_clear() properly resets the lru_cache."""
        from apps.rankings.views import load_ranking_data
        # Call to populate cache
        result_first = load_ranking_data(2024, 'overall')
        assert result_first is not None
        # Clear cache
        load_ranking_data.cache_clear()
        # Call again — should re-read from disk
        result_second = load_ranking_data(2024, 'overall')
        assert result_second is not None
        assert result_first == result_second
