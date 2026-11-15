import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the institute name and contact email', () => {
    render(<Footer onSelectTab={vi.fn()} />);
    expect(screen.getByText('IIT Mandi')).toBeInTheDocument();
    expect(screen.getByText('ranking.cell@iitmandi.ac.in')).toBeInTheDocument();
  });

  it('formats the provided lastUpdated date in en-IN long form', () => {
    render(<Footer lastUpdated="2024-01-15T00:00:00.000Z" onSelectTab={vi.fn()} />);
    expect(screen.getByText('15 January 2024')).toBeInTheDocument();
  });

  it('falls back to today when no lastUpdated date is provided', () => {
    const expected = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    render(<Footer onSelectTab={vi.fn()} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('invokes onSelectTab with the right key for each portal module button', async () => {
    const onSelectTab = vi.fn();
    render(<Footer onSelectTab={onSelectTab} />);

    await userEvent.click(screen.getByText('Year-wise Trend Analytics'));

    expect(onSelectTab).toHaveBeenCalledWith('trends');
  });

  it('shows the current year in the copyright line', () => {
    render(<Footer onSelectTab={vi.fn()} />);
    const year = new Date().getFullYear().toString();
    const copyright = screen.getByText(
      (_, element) => element?.tagName === 'P' && element.textContent === `© ${year} Indian Institute of Technology Mandi. All Rights Reserved.`,
    );
    expect(copyright).toBeInTheDocument();
  });
});
