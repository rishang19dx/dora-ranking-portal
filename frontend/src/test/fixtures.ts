import { RankingItem } from '../types';

/** Builds a valid RankingItem with sensible defaults, overridable per test. */
export function makeRanking(overrides: Partial<RankingItem> = {}): RankingItem {
  return {
    id: 'rk-1',
    agency_id: 'nirf',
    agency_name: 'NIRF',
    ranking_name: 'Overall',
    category: 'Overall',
    year: 2024,
    rank: 26,
    previous_rank: 31,
    total_institutions: 200,
    score: 55.5,
    percentile: 87,
    status: 'Published',
    verified: true,
    source_url: 'https://example.com/report.pdf',
    is_demo: false,
    created_at: '2024-08-01T00:00:00.000Z',
    updated_at: '2024-08-01T00:00:00.000Z',
    ...overrides,
  };
}
