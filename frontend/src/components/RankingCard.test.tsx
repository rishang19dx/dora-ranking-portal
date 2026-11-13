import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingCard } from './RankingCard';
import { makeRanking } from '../test/fixtures';

describe('RankingCard', () => {
  it('renders the agency, ranking name and current rank', () => {
    render(<RankingCard ranking={makeRanking({ agency_name: 'NIRF', ranking_name: 'Overall', rank: 26 })} />);

    expect(screen.getByText('NIRF')).toBeInTheDocument();
    expect(screen.getByText('Overall')).toBeInTheDocument();
    // The rendered rank is split across a "#" span and a bare text node, so
    // match on the combined textContent of the containing element.
    expect(screen.getByText((_, element) => element?.textContent === '#26')).toBeInTheDocument();
  });

  it('shows the Verified badge only when the ranking is verified', () => {
    render(<RankingCard ranking={makeRanking({ verified: true })} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('hides the Verified badge when the ranking is not verified', () => {
    render(<RankingCard ranking={makeRanking({ verified: false })} />);
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('shows "Demo Data" when is_demo is true', () => {
    render(<RankingCard ranking={makeRanking({ is_demo: true })} />);
    expect(screen.getByText('Demo Data')).toBeInTheDocument();
  });

  it('shows N/A for previous rank when there is none', () => {
    render(<RankingCard ranking={makeRanking({ previous_rank: undefined })} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('New Entry')).toBeInTheDocument();
  });

  it('calls onSelect with the ranking when the card is clicked', async () => {
    const onSelect = vi.fn();
    const ranking = makeRanking();
    render(<RankingCard ranking={ranking} onSelect={onSelect} />);

    await userEvent.click(screen.getByText(ranking.ranking_name));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(ranking);
  });

  it('falls back to onClick when onSelect is not provided', async () => {
    const onClick = vi.fn();
    const ranking = makeRanking();
    render(<RankingCard ranking={ranking} onClick={onClick} />);

    await userEvent.click(screen.getByText(ranking.ranking_name));

    expect(onClick).toHaveBeenCalledWith(ranking);
  });

  it('prefers onSelect over onClick when both are provided', async () => {
    const onSelect = vi.fn();
    const onClick = vi.fn();
    const ranking = makeRanking();
    render(<RankingCard ranking={ranking} onSelect={onSelect} onClick={onClick} />);

    await userEvent.click(screen.getByText(ranking.ranking_name));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('hides score/year and extra detail rows in compact mode', () => {
    render(<RankingCard ranking={makeRanking()} compact />);
    expect(screen.queryByText('Score / Year')).not.toBeInTheDocument();
  });

  it('links to the official source when source_url is present', () => {
    render(<RankingCard ranking={makeRanking({ source_url: 'https://example.com/report.pdf' })} />);
    const link = screen.getByRole('link', { name: /official source/i });
    expect(link).toHaveAttribute('href', 'https://example.com/report.pdf');
  });

  it('shows a fallback label when there is no source_url', () => {
    render(<RankingCard ranking={makeRanking({ source_url: undefined })} />);
    expect(screen.getByText('Official Source Logged')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /official source/i })).not.toBeInTheDocument();
  });
});
