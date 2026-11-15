import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/test-utils';
import AdminAuditLog from './AdminAuditLog';

const list = vi.fn();
const exportCsv = vi.fn();

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, auditService: { list: (...a: unknown[]) => list(...a), exportCsv: (...a: unknown[]) => exportCsv(...a) } };
});

const page = {
  count: 2,
  page: 1,
  pageSize: 50,
  actions: ['REJECT', 'UPDATE'],
  results: [
    {
      id: 'aud_1', timestamp: '2026-11-16T10:00:00Z', action: 'UPDATE', actorType: 'OFFICER',
      actorId: 'no_1', actorName: 'SRIC Officer', submissionId: 'sub_1', sectionId: 'sponsored-research',
      unitId: 'sponsored-research', unitName: 'Sponsored Research', requestId: 'req_1',
      requestReference: 'DORA/2027/NIRF/001', cycleYear: 2027, changeCount: 1,
      delta: { changes: [{ block: 'sponsored', row: 'projects', field: '2025-26', old: 180, new: 184 }] },
    },
    {
      id: 'aud_2', timestamp: '2026-11-16T11:00:00Z', action: 'REJECT', actorType: 'ADMIN',
      actorId: '1', actorName: 'admin', submissionId: 'sub_1', sectionId: 'sponsored-research',
      unitId: 'sponsored-research', unitName: 'Sponsored Research', requestId: 'req_1',
      requestReference: 'DORA/2027/NIRF/001', cycleYear: 2027, changeCount: 0,
      delta: { fromStatus: 'SUBMITTED', toStatus: 'CORRECTION_REQUESTED', comment: 'Agency count looks low' },
    },
  ],
};

describe('AdminAuditLog', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue(page);
    exportCsv.mockReset().mockResolvedValue(undefined);
  });

  it('lists entries with actor, transition and value changes', async () => {
    renderWithProviders(<AdminAuditLog />);
    expect(await screen.findByText('SRIC Officer')).toBeInTheDocument();
    expect(screen.getByText(/SUBMITTED → CORRECTION_REQUESTED/)).toBeInTheDocument();
    expect(screen.getByText('1 value change')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0]);
    expect(screen.getByText('180')).toBeInTheDocument();
    expect(screen.getByText('184')).toBeInTheDocument();
  });

  it('filters by action and searches', async () => {
    renderWithProviders(<AdminAuditLog />);
    await screen.findByText('SRIC Officer');

    await userEvent.selectOptions(screen.getByLabelText('Action'), 'REJECT');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'REJECT', page: 1 })));

    await userEvent.type(screen.getByLabelText('Search the audit log'), 'agency{enter}');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'agency' })));
  });

  it('exports the filtered trail', async () => {
    renderWithProviders(<AdminAuditLog />);
    await screen.findByText('SRIC Officer');
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    await waitFor(() => expect(exportCsv).toHaveBeenCalled());
  });
});
