import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, signInAs } from '../../test/test-utils';
import AdminReminders from './AdminReminders';

const schedule = vi.fn();
const run = vi.fn();
const setAutoRemind = vi.fn();

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    reminderService: {
      schedule: (...a: unknown[]) => schedule(...a),
      run: (...a: unknown[]) => run(...a),
      setAutoRemind: (...a: unknown[]) => setAutoRemind(...a),
    },
  };
});

const payload = {
  policy: { daysBefore: [7, 3, 1], overdueIntervalDays: 3, overdueMax: 3, manualCooldownHours: 20 },
  requests: [{
    id: 'req_1', reference: 'DORA/2027/NIRF/001', title: 'NIRF 2027 data call', deadline: '2026-12-01T18:29:59Z',
    autoRemind: true, sections: 4, sectionsAwaiting: 2, overdue: false,
    timeline: [
      { milestone: 'T-7', dueAt: '2026-11-24T18:29:59Z', overdue: false, state: 'SENT', sectionsAwaiting: null,
        sections: [{ unitId: 'sbs', outcome: 'SENT', detail: '1 message(s) sent.', deliveries: 1, at: '2026-11-24T19:00:00Z' }] },
      { milestone: 'T-3', dueAt: '2026-11-28T18:29:59Z', overdue: false, state: 'UPCOMING', sectionsAwaiting: 2, sections: [] },
      { milestone: 'OVERDUE-1', dueAt: '2026-12-01T19:29:59Z', overdue: true, state: 'UPCOMING', sectionsAwaiting: 2, sections: [] },
    ],
  }],
  recent: [{ id: 'rem_1', requestId: 'req_1', reference: 'DORA/2027/NIRF/001', unitId: 'sbs', unitName: 'SBS',
    milestone: 'T-7', outcome: 'SENT', detail: '1 message(s) sent.', deliveries: 1, at: '2026-11-24T19:00:00Z' }],
};

describe('AdminReminders', () => {
  beforeEach(() => {
    schedule.mockReset().mockResolvedValue(payload);
    run.mockReset().mockResolvedValue({ ranAt: '2026-11-25T10:00:00Z', dryRun: true, sent: [
      { requestId: 'req_1', reference: 'DORA/2027/NIRF/001', unitId: 'scee', milestone: 'T-3' },
    ], skipped: [] });
    setAutoRemind.mockReset().mockResolvedValue({ autoRemind: false, message: 'Automated reminders paused for this request.' });
  });
  afterEach(() => localStorage.clear());

  it('shows the policy and each milestone with its state', async () => {
    signInAs('ADMIN');
    renderWithProviders(<AdminReminders />);
    expect(await screen.findByText('NIRF 2027 data call')).toBeInTheDocument();
    expect(screen.getByText(/7d, 3d, 1d/)).toBeInTheDocument();
    expect(screen.getAllByText('7d before').length).toBe(2); // timeline + recent table
    expect(screen.getByText('Overdue #1')).toBeInTheDocument();
    expect(screen.getByText(/sent · 1 section/)).toBeInTheDocument();
    expect(screen.getByText('Recent automated reminders')).toBeInTheDocument();
  });

  it('lets an admin preview due reminders and pause a request', async () => {
    signInAs('ADMIN');
    renderWithProviders(<AdminReminders />);
    await userEvent.click(await screen.findByRole('button', { name: /Preview due/i }));
    expect(run).toHaveBeenCalledWith(true);
    expect(await screen.findByRole('status')).toHaveTextContent('scee');

    await userEvent.click(screen.getByRole('button', { name: /Reminders on · pause/i }));
    await waitFor(() => expect(setAutoRemind).toHaveBeenCalledWith('req_1', false));
    expect(await screen.findByRole('button', { name: /Paused · resume/i })).toBeInTheDocument();
  });

  it('is read-only for the Director', async () => {
    signInAs('DIRECTOR');
    renderWithProviders(<AdminReminders />);
    expect(await screen.findByText('NIRF 2027 data call')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send due now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.getByText('Reminders on')).toBeInTheDocument();
  });
});
