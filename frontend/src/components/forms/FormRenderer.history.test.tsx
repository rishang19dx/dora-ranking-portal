/**
 * Spec 2.6: previously approved values shown beside new entries, with the
 * change recomputed live as the officer types.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import FormRenderer from './FormRenderer';
import type { SectionHistory } from './HistoryHint';

const section = {
  id: 'sponsored-research',
  title: 'Sponsored Research',
  blocks: [{
    id: 'sponsored',
    kind: 'grid',
    title: 'Sponsored research',
    rowAxis: { type: 'fixed' },
    columnAxis: { type: 'years' },
    resolvedColumns: [
      { id: '2025-26', label: '2025-26', type: 'integer' },
      { id: '2024-25', label: '2024-25', type: 'integer' },
    ],
    resolvedRows: [{ id: 'projects', label: 'Number of projects' }],
  }],
};

const base = { previousCycle: 2026, change: null, changePct: null, direction: null, restated: false } as const;
const history: SectionHistory = {
  previousCycle: 2026,
  previousReference: 'DORA/2026/NIRF/001',
  cells: {
    sponsored: {
      projects: {
        '2025-26': { ...base, previous: 40, basis: 'prior-period', period: '2024-25' },
        '2024-25': { ...base, previous: 40, basis: 'same-period', period: '2024-25' },
      },
    },
  },
  questions: {},
  records: {},
};

describe('FormRenderer history hints', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup(payload: Record<string, any> = {}) {
    return renderWithProviders(
      <FormRenderer token="tok" section={section} history={history} initialData={{ revision: 1, payload }} />,
    );
  }

  it('shows the previous figure beside empty inputs and names the baseline', () => {
    setup();
    expect(screen.getByTestId('history-banner')).toHaveTextContent('NIRF 2026 (DORA/2026/NIRF/001)');
    const hints = screen.getAllByTestId('history-hint');
    expect(hints[0]).toHaveTextContent('2024-25 (NIRF 2026): 40');
    expect(hints[1]).toHaveTextContent('Reported in NIRF 2026: 40');
  });

  it('recomputes the change live and highlights a big drop', () => {
    setup();
    const [newest] = screen.getAllByRole('spinbutton');
    fireEvent.change(newest, { target: { value: '10' } });
    const hint = screen.getAllByTestId('history-hint')[0];
    expect(hint).toHaveTextContent('▼ 75.0%');
    expect(hint.className).toContain('text-orange-700');
  });

  it('calls out a restated figure for a year already reported', () => {
    setup({ sponsored: { projects: { '2024-25': 44 } } });
    const hint = screen.getAllByTestId('history-hint')[1];
    expect(hint).toHaveTextContent('▲ 10.0%');
    expect(hint).toHaveTextContent('restated');
  });

  it('marks an unchanged figure quietly', () => {
    setup({ sponsored: { projects: { '2024-25': 40 } } });
    const hint = screen.getAllByTestId('history-hint')[1];
    expect(hint).toHaveTextContent('unchanged');
    expect(hint.className).toContain('text-zinc-400');
  });

  it('renders no hints without history', () => {
    renderWithProviders(<FormRenderer token="tok" section={section} initialData={{ revision: 1, payload: {} }} />);
    expect(screen.queryByTestId('history-hint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('history-banner')).not.toBeInTheDocument();
  });
});
