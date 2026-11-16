import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import { TrendsView } from './TrendsView';

let staff = false;
let fetchImpl: () => Promise<unknown> = () => new Promise(() => {});
const getTrends = vi.fn();

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    isStaffUser: () => staff,
    rankingsService: {
      ...actual.rankingsService,
      getTrends: (...a: unknown[]) => getTrends(...a),
      getParameterTrends: () => Promise.resolve({ years: [], trends: {}, parameterOrder: [], labels: {}, weights: {} }),
      // Plain function: a vi.fn() returning a rejection leaves an unhandled
      // derived promise that fails the run.
      updateScraper: () => fetchImpl(),
    },
  };
});

const trends = {
  years: [2022, 2023, 2024, 2025, 2026], latestYear: 2026, categories: ['Engineering'],
  target_institute: 'Indian Institute of Technology Mandi', iit_mandi_trends: { Engineering: [] },
  peer_comparison: { Engineering: [] },
};

describe('TrendsView fetch button', () => {
  beforeEach(() => {
    getTrends.mockReset().mockResolvedValue(trends);
    fetchImpl = () => new Promise(() => {});
  });
  afterEach(() => { staff = false; });

  it('is hidden from public visitors', async () => {
    staff = false;
    renderWithProviders(<TrendsView />);
    await waitFor(() => expect(getTrends).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Fetch new NIRF results/ })).not.toBeInTheDocument();
  });

  it('labels the window from the data, not a fixed year', async () => {
    renderWithProviders(<TrendsView />);
    expect(await screen.findByText(/2022 – 2026 Cycle/)).toBeInTheDocument();
  });

  it('lets staff fetch and reports the outcome', async () => {
    staff = true;
    fetchImpl = () => Promise.resolve({
      message: 'Fetched NIRF 2026.', mode: 'new-only', latestYear: 2026,
      fetched: [{ year: 2026, category: 'Engineering', institutions: 100 }],
      notPublishedYet: [], failed: [],
    });
    renderWithProviders(<TrendsView />);
    await userEvent.click(await screen.findByRole('button', { name: /Fetch new NIRF results/ }));
    expect(await screen.findByText('Fetched NIRF 2026.')).toBeInTheDocument();
    await waitFor(() => expect(getTrends).toHaveBeenCalledTimes(2), { timeout: 3000 });
  });

  it('explains a concurrent fetch', async () => {
    staff = true;
    const busy = Object.assign(new Error('Request failed with status code 409'), { response: { status: 409, data: {} } });
    fetchImpl = () => Promise.reject(busy);
    renderWithProviders(<TrendsView />);
    await userEvent.click(await screen.findByRole('button', { name: /Fetch new NIRF results/ }));
    expect(await screen.findByText(/already running/)).toBeInTheDocument();
  });
});
