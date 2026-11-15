import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/test-utils';
import AdminProofRepository from './AdminProofRepository';

const list = vi.fn();
const download = vi.fn();

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, proofService: { list: (...a: unknown[]) => list(...a), download: (...a: unknown[]) => download(...a) } };
});

const proof = {
  id: 'upl_2', requestId: 'req_1', requestReference: 'DORA/2027/NIRF/001', cycleYear: 2027,
  unitId: 'sponsored-research', unitName: 'Sponsored Research', dataItemId: 'sponsored-projects',
  fileName: 'sanction_orders.pdf', size: 2048, contentType: 'application/pdf',
  checksum: 'a'.repeat(64), note: 'Corrected amounts', uploadedAt: '2026-11-15T10:00:00Z',
  uploadedBy: 'SRIC Officer', version: 2, versionCount: 2, isLatest: true,
  downloadUrl: '/api/proofs/upl_2/download/',
  sections: [{ sectionId: 'sponsored-research', title: 'Sponsored Research Details' }],
};

describe('AdminProofRepository', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue({ count: 1, page: 1, pageSize: 50, results: [proof] });
    download.mockReset().mockResolvedValue(undefined);
  });

  it('shows each proof with its version and the sections it evidences', async () => {
    renderWithProviders(<AdminProofRepository />);
    expect(await screen.findByText('sanction_orders.pdf')).toBeInTheDocument();
    expect(screen.getByText(/v2 of 2 · current/)).toBeInTheDocument();
    expect(screen.getByText('Sponsored Research Details')).toBeInTheDocument();
  });

  it('searches, filters to current versions and downloads', async () => {
    renderWithProviders(<AdminProofRepository />);
    await screen.findByText('sanction_orders.pdf');

    await userEvent.type(screen.getByLabelText('Search proofs'), 'sanction{enter}');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'sanction' })));

    await userEvent.click(screen.getByLabelText(/Current versions only/));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ latestOnly: true })));

    await userEvent.click(screen.getByRole('button', { name: 'Download sanction_orders.pdf' }));
    expect(download).toHaveBeenCalledWith('upl_2', 'sanction_orders.pdf');
  });
});
