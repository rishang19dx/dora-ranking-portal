import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, signInAs } from '../../test/test-utils';
import AdminDiscrepancies from './AdminDiscrepancies';

const list = vi.fn();
const scan = vi.fn();
const act = vi.fn();
const aiLog = vi.fn();

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    discrepancyService: {
      list: (...a: unknown[]) => list(...a),
      scan: (...a: unknown[]) => scan(...a),
      act: (...a: unknown[]) => act(...a),
      aiLog: (...a: unknown[]) => aiLog(...a),
    },
  };
});

const flag = {
  id: 'flg_1', requestId: 'req_1', submissionId: 'sub_1', submissionStatus: 'SUBMITTED', unitId: 'sric',
  unitName: 'SRIC', sectionId: 'sponsored-research', kind: 'YOY_CHANGE', label: 'Sponsored › Projects › 2025-26',
  severity: 'CRITICAL', message: 'Down 80.0% on 2024-25 (50 in NIRF 2026).', previous: '50', current: '10',
  changePct: -80, details: {}, status: 'OPEN', resolutionNote: '', resolvedBy: null, resolvedAt: null,
  firstSeen: '2026-11-16T10:00:00Z', lastSeen: '2026-11-16T10:00:00Z',
  ai: { severity: 'CRITICAL', rationale: 'Moved from 50 to 10.', question: 'Were projects moved to another unit?', model: 'test-model', logId: 'ail_1' },
};

function payload(aiConfigured: boolean) {
  return {
    requestId: 'req_1',
    requests: [{ id: 'req_1', reference: 'DORA/2027/NIRF/001', title: 'NIRF 2027', cycleYear: 2027 }],
    summary: { open: 1, openCritical: 1, openWarning: 0, escalated: 0, dismissed: 0, resolved: 0 },
    thresholds: {},
    ai: aiConfigured ? { configured: true, provider: 'openrouter', model: 'test-model' } : { configured: false, reason: 'AI_PROVIDER is not set.' },
    flags: [flag],
  };
}

describe('AdminDiscrepancies', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue(payload(true));
    scan.mockReset().mockResolvedValue({ scan: { opened: 0, reopened: 0, resolved: 0, candidates: 1 }, ai: { configured: true, message: '1 flag(s) annotated.' } });
    act.mockReset().mockResolvedValue({ ...flag, status: 'ESCALATED', resolutionNote: 'Please confirm', resolvedBy: 'admin' });
    aiLog.mockReset().mockResolvedValue([{
      id: 'ail_1', createdAt: '2026-11-16T10:00:00Z', provider: 'openrouter', model: 'test-model', purpose: 'discrepancy-review',
      requestReference: 'DORA/2027/NIRF/001', triggeredBy: 'admin', status: 'OK', error: '', latencyMs: 812,
      flagsSent: 1, flagsAnnotated: 1, itemsRejected: 0, promptSha256: 'abcdef0123456789', prompt: { user: {} }, response: '{}',
    }]);
  });
  afterEach(() => localStorage.clear());

  it('shows rule flags with the AI note beside, never instead', async () => {
    signInAs('ADMIN');
    renderWithProviders(<AdminDiscrepancies />);
    expect(await screen.findByText('Sponsored › Projects › 2025-26')).toBeInTheDocument();
    expect(screen.getByText(/Down 80.0%/)).toBeInTheDocument();
    expect(screen.getByText(/50 → 10/)).toBeInTheDocument();
    expect(screen.getByTestId('ai-note')).toHaveTextContent('Were projects moved to another unit?');
    expect(screen.getByTestId('ai-status')).toHaveTextContent('openrouter');
  });

  it('runs a scan with AI review and escalates a flag to the department', async () => {
    signInAs('ADMIN');
    renderWithProviders(<AdminDiscrepancies />);
    await userEvent.click(await screen.findByRole('button', { name: /Scan \+ AI review/i }));
    expect(scan).toHaveBeenCalledWith('req_1', true);

    await userEvent.click(screen.getByRole('button', { name: /Ask department/i }));
    expect(screen.getByLabelText('Note')).toHaveValue('Were projects moved to another unit?');
    await userEvent.click(screen.getByRole('button', { name: /Send correction request/i }));
    await waitFor(() => expect(act).toHaveBeenCalledWith('flg_1', 'escalate', 'Were projects moved to another unit?'));
  });

  it('disables AI review when no provider is configured', async () => {
    list.mockResolvedValue(payload(false));
    signInAs('ADMIN');
    renderWithProviders(<AdminDiscrepancies />);
    expect(await screen.findByRole('button', { name: /Scan \+ AI review/i })).toBeDisabled();
    expect(screen.getByTestId('ai-status')).toHaveTextContent('AI review is off');
  });

  it('is read-only for the Director, without the AI log', async () => {
    signInAs('DIRECTOR');
    renderWithProviders(<AdminDiscrepancies />);
    expect(await screen.findByText('Sponsored › Projects › 2025-26')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-scan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dismiss$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ask department/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /AI request log/i })).not.toBeInTheDocument();
  });

  it('lets the auditor read the AI request log', async () => {
    signInAs('AUDITOR');
    renderWithProviders(<AdminDiscrepancies />);
    await userEvent.click(await screen.findByRole('button', { name: /AI request log/i }));
    expect(await screen.findByText(/1\/1 annotated/)).toBeInTheDocument();
    expect(screen.getByText(/sha256 abcdef012345/)).toBeInTheDocument();
  });
});
