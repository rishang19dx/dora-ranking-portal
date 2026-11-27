import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/test-utils';
import AdminGoLive from './AdminGoLive';

const svc = vi.hoisted(() => ({
  readiness: vi.fn(),
  pilots: vi.fn(),
  flagReviews: vi.fn(),
  syncFlags: vi.fn(),
  reviewFlag: vi.fn(),
  createPilot: vi.fn(),
  setPilotStatus: vi.fn(),
  uatScenarios: vi.fn(),
  recordUat: vi.fn(),
  drills: vi.fn(),
  backups: vi.fn(),
  createBackup: vi.fn(),
  training: vi.fn(),
  recordTraining: vi.fn(),
  signoffs: vi.fn(),
  signOff: vi.fn(),
}));

vi.mock('../../services/golive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/golive')>();
  return { ...actual, goLiveService: svc };
});

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, api: { get: vi.fn().mockResolvedValue({ data: [] }) } };
});

const readiness = {
  generatedAt: '2026-12-10T10:00:00Z',
  appVersion: '2.0.0',
  pilot: { id: 'plt_1', name: 'NIRF 2027 pilot', status: 'RUNNING' },
  kpis: {
    pilotId: 'plt_1',
    allPassed: false,
    kpis: [
      { key: 'ai_reliability', label: 'AI reliability', passed: true, value: 0.975, target: 0.95,
        summary: '97.5% accuracy over 40 reviewed checks; 0 critical false positive(s).', evidence: {} },
      { key: 'data_auditability', label: 'Data auditability', passed: true, value: 1, target: 1,
        summary: '120 of 120 modification events traced.', evidence: {} },
      { key: 'system_resilience', label: 'System resilience', passed: false, value: null,
        target: { rpoHours: 24, rtoHours: 8 }, summary: 'No witnessed DR drill recorded yet.',
        evidence: { latestWitnessed: null } },
    ],
  },
  gates: [
    { key: 'pilot', label: 'Controlled pilot', passed: false, blocking: true, summary: 'running', evidence: {} },
    { key: 'uat', label: 'User acceptance testing', passed: true, blocking: true, summary: '17 of 17', evidence: {} },
  ],
  recommendation: 'NO_GO',
  blockingFailures: ['pilot', 'system_resilience'],
  decision: null,
  handover: null,
};

describe('AdminGoLive', () => {
  beforeEach(() => {
    Object.values(svc).forEach((fn) => fn.mockReset());
    svc.readiness.mockResolvedValue(readiness);
    svc.signoffs.mockResolvedValue([]);
    svc.uatScenarios.mockResolvedValue([
      { code: 'UAT-01', title: 'Sign in', area: 'Access', role: 'ADMIN', priority: 'CRITICAL',
        steps: ['Open the portal'], expected: 'Lands on dashboard', latest: null, history: [] },
    ]);
    svc.recordUat.mockResolvedValue({});
  });

  it('shows the recommendation, KPIs and gates', async () => {
    renderWithProviders(<AdminGoLive />);
    expect(await screen.findByText('NO-GO')).toBeInTheDocument();
    expect(screen.getByText('97.5%')).toBeInTheDocument();
    expect(screen.getByText('No witnessed DR drill recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 gates passing', { exact: false })).toBeInTheDocument();
  });

  it('records a passing UAT result', async () => {
    renderWithProviders(<AdminGoLive />);
    await screen.findByText('NO-GO');
    await userEvent.click(screen.getByRole('tab', { name: 'UAT' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Record UAT-01 PASS' }));
    await waitFor(() => expect(svc.recordUat).toHaveBeenCalledWith('UAT-01', { status: 'PASS', notes: '', defectRef: '' }));
  });

  it('demands a justification before going live against NO-GO', async () => {
    renderWithProviders(<AdminGoLive />);
    await screen.findByText('NO-GO');
    await userEvent.click(screen.getByRole('tab', { name: 'Sign-off' }));
    await userEvent.selectOptions(await screen.findByLabelText('Sign-off kind'), 'GO_NO_GO');
    expect(screen.getByText(/Blocking gates: pilot, system_resilience/)).toBeInTheDocument();
  });
});
