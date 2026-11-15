/**
 * RankingDetailModal – unit + interaction tests.
 *
 * Tests:
 *  - Returns null when ranking prop is null
 *  - Renders ranking name, agency, category, year
 *  - Shows current rank and previous rank
 *  - Shows "N/A" for previous_rank when undefined
 *  - Shows "N/A" for score when undefined
 *  - Close button (header) calls onClose
 *  - Close Window button (footer) calls onClose
 *  - Shows source URL link when provided
 *  - Shows "Verified" badge when ranking.verified is true
 *  - Shows historical timeline for sibling rankings
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingDetailModal } from '../components/RankingDetailModal';
import { makeRanking } from '../test/fixtures';

// RankingDetailModal fetches /api/parameters and /api/documents on mount
// We stub fetch globally for these tests.
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Return empty arrays for both fetches so loading resolves cleanly
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
  });
  global.fetch = mockFetch as typeof fetch;
});

const baseRanking = makeRanking({
  id: 'rk-1',
  agency_name: 'NIRF India',
  ranking_name: 'NIRF Engineering 2025',
  category: 'Engineering',
  year: 2025,
  rank: 28,
  previous_rank: 31,
  score: 62.84,
  verified: true,
  source_url: 'https://www.nirfindia.org',
  remarks: 'Ranked 28th in Engineering category.',
});

function setup(props: Partial<React.ComponentProps<typeof RankingDetailModal>> = {}) {
  return render(
    <RankingDetailModal
      ranking={baseRanking}
      allRankings={[baseRanking]}
      onClose={vi.fn()}
      onOpenDoc={vi.fn()}
      {...props}
    />
  );
}

describe('RankingDetailModal', () => {
  it('renders nothing when ranking is null', () => {
    const { container } = render(
      <RankingDetailModal
        ranking={null}
        allRankings={[]}
        onClose={vi.fn()}
        onOpenDoc={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the ranking name in the header', () => {
    setup();
    expect(screen.getByText('NIRF Engineering 2025')).toBeInTheDocument();
  });

  it('renders agency name badge', () => {
    setup();
    expect(screen.getByText('NIRF India')).toBeInTheDocument();
  });

  it('renders category label', () => {
    setup();
    expect(screen.getByText(/Category: Engineering/i)).toBeInTheDocument();
  });

  it('shows current rank', () => {
    setup();
    expect(screen.getAllByText('#28').length).toBeGreaterThan(0);
  });

  it('shows previous rank', () => {
    setup();
    expect(screen.getByText('#31')).toBeInTheDocument();
  });

  it('shows "N/A" when previous_rank is not provided', () => {
    setup({ ranking: makeRanking({ previous_rank: undefined }) });
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows overall score', () => {
    setup();
    expect(screen.getByText('62.84 / 100')).toBeInTheDocument();
  });

  it('shows "N/A" when score is not provided', () => {
    setup({ ranking: makeRanking({ score: undefined }) });
    // The score cell should show N/A
    const naItems = screen.getAllByText('N/A');
    expect(naItems.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Verified" badge when ranking is verified', () => {
    setup();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('calls onClose when the close button in header is clicked', async () => {
    const onClose = vi.fn();
    setup({ onClose });
    // Header close button (top-right X)
    const buttons = screen.getAllByRole('button');
    const xButton = buttons.find((b) => !b.textContent?.trim() || b.textContent.trim() === '');
    await userEvent.click(xButton ?? buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when "Close Window" footer button is clicked', async () => {
    const onClose = vi.fn();
    setup({ onClose });
    await userEvent.click(screen.getByRole('button', { name: /Close Window/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders source URL link when provided', () => {
    setup();
    const link = screen.getByRole('link', { name: /View Official Source Website/i });
    expect(link).toHaveAttribute('href', 'https://www.nirfindia.org');
  });

  it('renders remarks text when provided', () => {
    setup();
    expect(screen.getByText('Ranked 28th in Engineering category.')).toBeInTheDocument();
  });

  it('renders historical timeline with the same ranking', async () => {
    setup();
    // The history shows the year — wait for fetch to resolve
    await waitFor(() => {
      expect(screen.getByText('2025')).toBeInTheDocument();
    });
  });

  it('renders "no files attached" text when documents are empty', async () => {
    setup();
    await waitFor(() => {
      expect(
        screen.getByText(/No external files attached/i)
      ).toBeInTheDocument();
    });
  });
});
