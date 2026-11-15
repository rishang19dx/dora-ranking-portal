/**
 * Integration tests: the real route table, layouts, providers and views wired
 * together. Only the network boundary (fetch + the axios rankings service) is
 * mocked, so these exercise navigation, data loading and error handling the way
 * a user would hit them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoutes from './routes';
import { renderWithProviders } from './test/test-utils';

vi.mock('./services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/api')>();
  return {
    ...actual,
    // Every service the routed views call is stubbed at the network boundary;
    // a view calling a method missing here throws, and Vitest fails the run
    // on the resulting unhandled error even when every assertion passes.
    rankingsService: {
      getRankings: vi.fn().mockResolvedValue({ count: 0, data: [] }),
      getSecondGenIITs: vi.fn().mockResolvedValue({ count: 0, data: [] }),
      getTrends: vi.fn().mockResolvedValue({}),
      updateScraper: vi.fn().mockResolvedValue({ message: 'ok' }),
      getParameterTrends: vi.fn().mockResolvedValue({ years: [], trends: {}, parameterOrder: [], labels: {}, weights: {} }),
      getGapAnalysis: vi.fn().mockResolvedValue({ analysis: {}, parameterOrder: [], labels: {}, weights: {} }),
    },
    analyticsService: {
      getDepartmentAnalytics: vi.fn().mockRejectedValue(new Error('not authenticated in tests')),
      downloadBriefing: vi.fn().mockResolvedValue(undefined),
    },
    auditService: {
      list: vi.fn().mockResolvedValue({ count: 0, page: 1, pageSize: 50, results: [], actions: [] }),
      exportCsv: vi.fn().mockResolvedValue(undefined),
    },
    proofService: {
      list: vi.fn().mockResolvedValue({ count: 0, page: 1, pageSize: 50, results: [] }),
      download: vi.fn().mockResolvedValue(undefined),
    },
  };
});

import { rankingsService } from './services/api';

type FetchHandler = (url: string, init?: RequestInit) => Partial<Response> & { json?: () => Promise<unknown> };

function mockFetch(handler: FetchHandler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = handler(String(input), init);
    return { ok: true, status: 200, json: async () => ({}), ...res } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderApp(path: string) {
  return renderWithProviders(<AppRoutes />, { routerProps: { initialEntries: [path] } });
}

const baseRequest = {
  id: 'req-1',
  reference: 'DR-2026-001',
  title: 'NIRF 2026 Faculty Data',
  framework: 'NIRF',
  cycleYear: 2026,
  subject: 's',
  message: 'm',
  deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
  dataItemIds: ['faculty-roster', 'student-intake'],
  targets: [
    { unitId: 'shss', status: 'SUBMITTED', officerIds: [], dataItemIds: ['faculty-roster'], remindersSent: 0 },
    { unitId: 'sbs', status: 'PENDING', officerIds: [], dataItemIds: ['student-intake'], remindersSent: 0 },
  ],
  deliveries: [
    { id: 'd1', officerId: 'o1', officerName: 'Asha Verma', unitId: 'shss', email: 'asha@iitmandi.ac.in', subject: 's', status: 'SENT', sentAt: new Date().toISOString(), kind: 'DISPATCH' },
  ],
  status: 'OPEN',
  createdBy: 'admin',
  createdAt: new Date().toISOString(),
  dispatchedAt: new Date().toISOString(),
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(rankingsService.getRankings).mockClear();
  mockFetch(() => ({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('routing', () => {
  it('renders the public landing page at /', () => {
    renderApp('/');
    expect(screen.getByRole('button', { name: /NIRF & Rankings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Admin Portal/i })).toBeInTheDocument();
  });

  it('redirects unknown paths to the public landing page', () => {
    renderApp('/definitely/not/a/page');
    expect(screen.getByRole('link', { name: /Admin Portal/i })).toBeInTheDocument();
  });

  it('renders the admin dashboard inside the dashboard layout at /admin', () => {
    renderApp('/admin');
    expect(screen.getByRole('heading', { name: 'Executive Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByText('Data Collection').length).toBeGreaterThan(0); // sidebar
  });

  it('renders the settings route', () => {
    renderApp('/admin/settings');
    expect(screen.getByText('Portal Configuration')).toBeInTheDocument();
  });

  it('renders the nodal officer dashboard at /nodal-officer', () => {
    renderApp('/nodal-officer');
    expect(screen.getByRole('heading', { name: 'Officer Overview' })).toBeInTheDocument();
    expect(screen.getAllByText('My Dashboard').length).toBeGreaterThan(0);
  });
});

describe('public landing flows', () => {
  it('switches tabs and loads live NIRF data for the rankings tab', async () => {
    renderApp('/');
    await userEvent.click(screen.getByRole('button', { name: /NIRF & Rankings/i }));
    await waitFor(() => expect(rankingsService.getRankings).toHaveBeenCalledWith(2025, 'overall'));
  });

  it('survives a failing rankings API without crashing', async () => {
    vi.mocked(rankingsService.getRankings).mockRejectedValueOnce(new Error('boom'));
    renderApp('/');
    await userEvent.click(screen.getByRole('button', { name: /NIRF & Rankings/i }));
    await waitFor(() => expect(rankingsService.getRankings).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /Admin Portal/i })).toBeInTheDocument();
  });

  it('navigates from the landing page to the admin portal', async () => {
    renderApp('/');
    await userEvent.click(screen.getByRole('link', { name: /Admin Portal/i }));
    expect(await screen.findByRole('heading', { name: 'Executive Dashboard' })).toBeInTheDocument();
  });

  it('navigates from the landing page to the nodal officer portal', async () => {
    renderApp('/');
    await userEvent.click(screen.getByRole('link', { name: /Nodal Officer Portal/i }));
    expect(await screen.findByRole('heading', { name: 'Officer Overview' })).toBeInTheDocument();
  });

  it('opens the login modal from the header', async () => {
    renderApp('/');
    await userEvent.click(screen.getByRole('button', { name: /Admin Login/i }));
    expect(await screen.findByRole('heading', { name: /IIT Mandi Admin Login/i })).toBeInTheDocument();
  });
});

describe('admin: data collection', () => {
  it('shows the empty state when no requests exist', async () => {
    mockFetch(() => ({ json: async () => ({ requests: [], uploads: [], transport: 'outbox' }) }));
    renderApp('/admin/data-collection');
    expect(await screen.findByText('No data request has been dispatched yet')).toBeInTheDocument();
    expect(screen.getByText(/No mail transport is configured/i)).toBeInTheDocument();
  });

  it('lists requests with progress, section counts and links to detail', async () => {
    mockFetch(() => ({
      json: async () => ({ requests: [baseRequest], uploads: [{}, {}], transport: 'resend' }),
    }));
    renderApp('/admin/data-collection');

    const title = await screen.findByText('NIRF 2026 Faculty Data');
    expect(screen.getByText('DR-2026-001')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText(/2 sections/)).toBeInTheDocument();
    expect(screen.getByText('Resend API')).toBeInTheDocument();
    expect(screen.queryByText(/No mail transport is configured/i)).not.toBeInTheDocument();
    expect(title.closest('a')).toHaveAttribute('href', '/admin/data-requests/req-1');
  });

  it('accepts a bare array payload from the API', async () => {
    mockFetch(() => ({ json: async () => [baseRequest] }));
    renderApp('/admin/data-collection');
    expect(await screen.findByText('NIRF 2026 Faculty Data')).toBeInTheDocument();
  });

  it('marks closed requests and flags overdue ones', async () => {
    const overdue = { ...baseRequest, id: 'r2', title: 'Late one', deadline: new Date(Date.now() - 3 * 86400000).toISOString() };
    const closed = { ...baseRequest, id: 'r3', title: 'Done one', status: 'CLOSED' };
    mockFetch(() => ({ json: async () => ({ requests: [overdue, closed], uploads: [], transport: 'resend' }) }));
    renderApp('/admin/data-collection');
    await screen.findByText('Late one');
    expect(screen.getByText(/d overdue/)).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('shows an error toast when the API fails', async () => {
    mockFetch(() => ({ ok: false, status: 500 }));
    renderApp('/admin/data-collection');
    expect(await screen.findByText('Unable to load data requests.')).toBeInTheDocument();
  });

  it('navigates to the composer via "New Data Request"', async () => {
    mockFetch(() => ({ json: async () => ({ requests: [], uploads: [], transport: 'resend' }) }));
    renderApp('/admin/data-collection');
    await userEvent.click(await screen.findByRole('link', { name: /New Data Request/i }));
    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Data Collection');
  });

  it('opens a request detail page from the list', async () => {
    mockFetch((url) =>
      url.includes('/api/data-requests/req-1')
        ? { json: async () => ({ ...baseRequest, uploads: [] }) }
        : { json: async () => ({ requests: [baseRequest], uploads: [], transport: 'resend' }) },
    );
    renderApp('/admin/data-collection');
    await userEvent.click(await screen.findByText('NIRF 2026 Faculty Data'));
    expect(await screen.findByRole('heading', { level: 1, name: /NIRF 2026 Faculty Data/ })).toBeInTheDocument();
    expect(screen.getByText('DR-2026-001')).toBeInTheDocument();
  });

  it('shows an error toast when a request detail cannot be loaded', async () => {
    mockFetch(() => ({ ok: false, status: 404 }));
    renderApp('/admin/data-requests/missing');
    expect(await screen.findByText('This data request could not be loaded.')).toBeInTheDocument();
  });
});

describe('admin: organogram', () => {
  it('renders the organogram tree and the active unit details after loading', async () => {
    mockFetch(() => ({ json: async () => ({ coverage: {}, officers: [] }) }));
    renderApp('/admin/organogram');
    expect(await screen.findByRole('heading', { name: 'Institute Organogram' })).toBeInTheDocument();
    expect(await screen.findAllByText('Registrar')).not.toHaveLength(0);
  });

  it('shows an error toast when the organogram API fails', async () => {
    mockFetch(() => ({ ok: false, status: 500 }));
    renderApp('/admin/organogram');
    expect(await screen.findByText('Unable to load the organogram.')).toBeInTheDocument();
  });

  it('selecting units updates the composer link', async () => {
    mockFetch(() => ({ json: async () => ({ coverage: {}, officers: [] }) }));
    renderApp('/admin/organogram');
    await screen.findByRole('heading', { name: 'Institute Organogram' });
    const boxes = await screen.findAllByRole('button', { name: /^Select /i });
    if (boxes.length) {
      const enabled = boxes.find((b) => !(b as HTMLButtonElement).disabled)!;
      await userEvent.click(enabled);
      const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.includes('units='));
      expect(links.length).toBeGreaterThan(0);
    }
  });
});

describe('admin: nodal officers', () => {
  it('loads and renders the nodal officers page', async () => {
    mockFetch(() => ({ json: async () => ({ officers: [], coverage: {} }) }));
    renderApp('/admin/nodal-officers');
    expect(await screen.findByRole('heading', { name: /Nodal Officers/i })).toBeInTheDocument();
  });
});

describe('restricted upload portal (/portal/:token)', () => {
  const context = {
    grant: { id: 'g1', officerId: 'o1', requestId: 'req-1', orgUnitId: 'library', dataItemIds: ['library-resources'], expiresAt: '2030-01-31T00:00:00.000Z', useCount: 0, createdAt: '2026-01-01T00:00:00.000Z' },
    request: { id: 'req-1', reference: 'DR-2026-001', title: 'Library Evidence Request', framework: 'NIRF', cycleYear: 2026, deadline: '2030-01-15T00:00:00.000Z', subject: 's', message: 'm' },
    orgUnit: { id: 'library', name: 'Library' },
    officer: { name: 'Asha Verma', email: 'asha@iitmandi.ac.in' },
    allowedDataItems: ['library-resources'],
    uploads: [],
  };

  it('requests the context for the token in the URL and renders it', async () => {
    const fetchMock = mockFetch(() => ({ json: async () => context }));
    renderApp('/portal/abc123');
    expect(await screen.findByRole('heading', { name: 'Library Evidence Request' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/portal/abc123/');
    expect(screen.getByText('Asha Verma')).toBeInTheDocument();
    expect(screen.getByText('asha@iitmandi.ac.in')).toBeInTheDocument();
    expect(screen.getByText('Assigned Unit / Department')).toBeInTheDocument();
  });

  it('shows the server error for an invalid or expired token', async () => {
    mockFetch(() => ({ ok: false, status: 403, json: async () => ({ error: 'This link has expired.' }) }));
    renderApp('/portal/expired');
    expect(await screen.findByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(screen.getByText('This link has expired.')).toBeInTheDocument();
  });

  it('shows a connectivity message when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    renderApp('/portal/abc');
    expect(await screen.findByText('Unable to connect to the portal service.')).toBeInTheDocument();
  });

  it('lets the user leave the error page for the public portal', async () => {
    mockFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
    renderApp('/portal/bad');
    await userEvent.click(await screen.findByRole('link', { name: /public portal/i }));
    expect(await screen.findByRole('link', { name: /Admin Portal/i })).toBeInTheDocument();
  });
});

describe('nodal officer flow', () => {
  it('navigates from the dashboard to the submission form', async () => {
    // The dashboard builds its task cards from the dispatched requests, and the
    // Submit Data link hangs off a card, so the list has to be served.
    mockFetch(() => ({ json: async () => ({ requests: [baseRequest] }) }));
    renderApp('/nodal-officer');
    const main = screen.getByRole('main');
    await userEvent.click(await within(main).findByRole('link', { name: /Submit Data/i }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Officer Overview' })).not.toBeInTheDocument(),
    );
  });
});
