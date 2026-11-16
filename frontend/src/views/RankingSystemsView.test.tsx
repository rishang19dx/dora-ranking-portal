import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import { RankingSystemsView } from './RankingSystemsView';

const systems = vi.fn();

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, publicRankingService: { ...actual.publicRankingService, systems: () => systems() } };
});

const point = (year: number, rankText: string, plotRank: number, demo = false, rankHigh: number | null = plotRank) => ({
  year, rankText, rankLow: plotRank, rankHigh, plotRank, score: null, source: '', demo,
});

const payload = {
  institute: 'IIT Mandi',
  lowerIsBetter: true,
  hasDemoData: true,
  systems: [
    { id: 'NIRF_ENGINEERING', label: 'NIRF Engineering', family: 'NIRF', series: [point(2024, '31', 31), point(2025, '26', 26)] },
    { id: 'QS_WORLD', label: 'QS World University Rankings', family: 'QS', series: [
      { ...point(2025, '651-700', 675.5, true), rankLow: 651, rankHigh: 700 },
      { ...point(2026, '601-650', 625.5, true), rankLow: 601, rankHigh: 650 },
    ] },
  ],
};

describe('RankingSystemsView (public, no login)', () => {
  beforeEach(() => { systems.mockReset().mockResolvedValue(payload); });

  it('renders one chart per system with latest rank and movement', async () => {
    renderWithProviders(<RankingSystemsView />);
    const nirf = await screen.findByRole('article', { name: 'NIRF Engineering trend' });
    expect(within(nirf).getByText('#26')).toBeInTheDocument();
    expect(within(nirf).getByText(/▲ 5 places since 2024/)).toBeInTheDocument();
    const qs = screen.getByRole('article', { name: 'QS World University Rankings trend' });
    expect(within(qs).getByText('Illustrative')).toBeInTheDocument();
    expect(within(qs).getByText(/band’s midpoint/)).toBeInTheDocument();
  });

  it('labels demo data and filters by system', async () => {
    renderWithProviders(<RankingSystemsView />);
    expect(await screen.findByRole('note')).toHaveTextContent('demonstration data');
    await userEvent.click(screen.getByRole('button', { name: 'NIRF' }));
    expect(screen.queryByRole('article', { name: /QS World/ })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'NIRF Engineering trend' })).toBeInTheDocument();
  });

  it('offers the same data as a table', async () => {
    renderWithProviders(<RankingSystemsView />);
    await screen.findByRole('article', { name: 'NIRF Engineering trend' });
    await userEvent.click(screen.getByRole('button', { name: /Table/ }));
    const table = screen.getByRole('table');
    expect(within(table).getByText('601-650')).toBeInTheDocument();
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('says so when the data cannot be loaded', async () => {
    systems.mockImplementation(() => Promise.reject(new Error('down')));
    renderWithProviders(<RankingSystemsView />);
    expect(await screen.findByText(/unavailable right now/)).toBeInTheDocument();
  });
});

describe('rankAxis', () => {
  it('uses even, rounded steps with headroom', async () => {
    const { rankAxis } = await import('./RankingSystemsView');
    expect(rankAxis([31, 26])).toEqual({ domain: [24, 32], ticks: [24, 26, 28, 30, 32] });
    const qs = rankAxis([900.5, 625.5]);
    expect(qs.ticks.every((t, i, a) => i === 0 || t - a[i - 1] === a[1] - a[0])).toBe(true);
    expect(qs.domain[0]).toBeLessThan(625.5);
    expect(qs.domain[1]).toBeGreaterThan(900.5);
    expect(rankAxis([10, 10]).ticks[0]).toBeGreaterThanOrEqual(1);
  });
});
