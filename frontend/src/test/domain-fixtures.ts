/**
 * Shared fixture factories for test data.
 * Extending the existing fixtures.ts with richer domain objects.
 */

import type {
  NirfRankItem,
  TrendsApiResponse,
  MandiYearlyTrend,
  PeerInstituteTrend,
} from '../types';

// ---------------------------------------------------------------------------
// NIRF rank items
// ---------------------------------------------------------------------------
export function makeNirfRankItem(overrides: Partial<NirfRankItem> = {}): NirfRankItem {
  return {
    institute_id: 'IR-E-U-0304',
    name: 'Indian Institute of Technology Mandi',
    city: 'Mandi',
    state: 'Himachal Pradesh',
    score: 62.84,
    rank: 28,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Trends API response
// ---------------------------------------------------------------------------
export function makeMandiYearlyTrend(year: number, rank: number, overrides: Partial<MandiYearlyTrend> = {}): MandiYearlyTrend {
  return {
    year,
    rank,
    score: 60 + Math.random() * 10,
    previous_rank: rank + 3,
    rank_change: 3,
    ...overrides,
  };
}

export function makePeerTrend(overrides: Partial<PeerInstituteTrend> = {}): PeerInstituteTrend {
  return {
    institute: 'Indian Institute of Technology Mandi',
    short_name: 'IIT Mandi',
    is_target: true,
    ranks: { '2021': 36, '2022': 34, '2023': 32, '2024': 30, '2025': 28 },
    scores: { '2021': 55.0, '2022': 57.0, '2023': 59.0, '2024': 61.0, '2025': 62.84 },
    latest_rank: 28,
    latest_score: 62.84,
    ...overrides,
  };
}

export function makeTrendsApiResponse(overrides: Partial<TrendsApiResponse> = {}): TrendsApiResponse {
  const years = [2021, 2022, 2023, 2024, 2025];

  const mandiEngineering: MandiYearlyTrend[] = [
    makeMandiYearlyTrend(2021, 36, { previous_rank: undefined, rank_change: 0, score: 55.0 }),
    makeMandiYearlyTrend(2022, 34, { previous_rank: 36, rank_change: 2, score: 57.0 }),
    makeMandiYearlyTrend(2023, 32, { previous_rank: 34, rank_change: 2, score: 59.0 }),
    makeMandiYearlyTrend(2024, 30, { previous_rank: 32, rank_change: 2, score: 61.0 }),
    makeMandiYearlyTrend(2025, 28, { previous_rank: 30, rank_change: 2, score: 62.84 }),
  ];

  const mandiOverall: MandiYearlyTrend[] = [
    makeMandiYearlyTrend(2021, 80, { previous_rank: undefined, rank_change: 0, score: 50.0 }),
    makeMandiYearlyTrend(2022, 75, { previous_rank: 80, rank_change: 5, score: 52.0 }),
    makeMandiYearlyTrend(2023, 71, { previous_rank: 75, rank_change: 4, score: 53.5 }),
    makeMandiYearlyTrend(2024, 67, { previous_rank: 71, rank_change: 4, score: 54.0 }),
    makeMandiYearlyTrend(2025, 64, { previous_rank: 67, rank_change: 3, score: 54.12 }),
  ];

  const mandiInnovation: MandiYearlyTrend[] = [
    makeMandiYearlyTrend(2021, 25, { previous_rank: undefined, rank_change: 0, score: null as any }),
    makeMandiYearlyTrend(2022, 22, { previous_rank: 25, rank_change: 3, score: null as any }),
    makeMandiYearlyTrend(2023, 20, { previous_rank: 22, rank_change: 2, score: null as any }),
    makeMandiYearlyTrend(2024, 19, { previous_rank: 20, rank_change: 1, score: null as any }),
    makeMandiYearlyTrend(2025, 18, { previous_rank: 19, rank_change: 1, score: null as any }),
  ];

  const peerEngineering: PeerInstituteTrend[] = [
    makePeerTrend(),
    makePeerTrend({
      institute: 'Indian Institute of Technology Hyderabad',
      short_name: 'IIT Hyderabad',
      is_target: false,
      ranks: { '2021': 14, '2022': 15, '2023': 14, '2024': 13, '2025': 12 },
      scores: { '2021': 70.0, '2022': 71.0, '2023': 72.0, '2024': 73.0, '2025': 74.0 },
      latest_rank: 12,
      latest_score: 74.0,
    }),
    makePeerTrend({
      institute: 'Indian Institute of Technology Indore',
      short_name: 'IIT Indore',
      is_target: false,
      ranks: { '2021': 20, '2022': 20, '2023': 19, '2024': 18, '2025': 17 },
      scores: { '2021': 66.0, '2022': 67.0, '2023': 68.0, '2024': 69.0, '2025': 70.0 },
      latest_rank: 17,
      latest_score: 70.0,
    }),
  ];

  return {
    years,
    categories: ['Engineering', 'Innovation', 'Overall'],
    target_institute: 'IIT Mandi',
    iit_mandi_trends: {
      Engineering: mandiEngineering,
      Overall: mandiOverall,
      Innovation: mandiInnovation,
    },
    peer_comparison: {
      Engineering: peerEngineering,
      Overall: peerEngineering,
      Innovation: peerEngineering,
    },
    ...overrides,
  };
}
