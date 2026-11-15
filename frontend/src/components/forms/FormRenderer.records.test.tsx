import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/test-utils';
import FormRenderer from './FormRenderer';

const section = {
  id: 'startup-ecosystem',
  title: 'Startups',
  blocks: [{
    id: 'innovation-grants',
    kind: 'records',
    title: 'Innovation grants',
    fields: [
      { id: 'govtOrganisation', label: 'Government organisation', type: 'text', required: true },
      { id: 'programme', label: 'Programme', type: 'text', required: true },
      { id: 'amount', label: 'Amount', type: 'currencyInr', required: true },
    ],
  }],
};

function stubSave(serverId = 'rec_new') {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const sent = JSON.parse(String(init?.body ?? '{}'));
    const rows = (sent.records?.['innovation-grants'] ?? []).map((r: any) => ({ ...r, _id: r._id ?? serverId }));
    return {
      ok: true,
      status: 200,
      json: async () => ({ revision: (sent.revision ?? 1) + 1, records: { 'innovation-grants': rows } }),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('FormRenderer records persistence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends rows typed into a records table with the autosave', async () => {
    const fetchMock = stubSave();
    renderWithProviders(
      <FormRenderer token="tok" section={section} initialData={{ revision: 1, payload: {}, records: {} }} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Add first row/i }));
    const [org] = screen.getAllByRole('textbox');
    await userEvent.type(org, 'DST');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 4000 });
    const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(body.records['innovation-grants'][0].govtOrganisation).toBe('DST');
  });

  it('adopts the server id so the next save updates instead of re-creating', async () => {
    const fetchMock = stubSave('rec_42');
    renderWithProviders(
      <FormRenderer token="tok" section={section} initialData={{ revision: 1, payload: {}, records: {} }} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Add first row/i }));
    await userEvent.type(screen.getAllByRole('textbox')[0], 'DST');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 4000 });

    await userEvent.type(screen.getAllByRole('textbox')[1], 'TIDE');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 4000 });
    const second = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(second.records['innovation-grants'][0]._id).toBe('rec_42');
  });
});
