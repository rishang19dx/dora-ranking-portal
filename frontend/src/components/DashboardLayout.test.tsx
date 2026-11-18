import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { renderWithProviders } from '../test/test-utils';

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<div>Public Landing</div>} />
      <Route path="/admin" element={<DashboardLayout />}>
        <Route index element={<div>Admin Home Content</div>} />
        <Route path="organogram" element={<div>Organogram Content</div>} />
      </Route>
      <Route path="/nodal-officer" element={<DashboardLayout />}>
        <Route index element={<div>Officer Home Content</div>} />
      </Route>
    </Routes>,
    { routerProps: { initialEntries: [path] } },
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('DashboardLayout', () => {
  it('renders the nested route content in the outlet', () => {
    renderAt('/admin');
    expect(screen.getByText('Admin Home Content')).toBeInTheDocument();
  });

  it('shows admin navigation on /admin routes', () => {
    renderAt('/admin');
    ['Dashboard', 'Organogram', 'Data Collection', 'Nodal Officers', 'Ranking Results', 'Documents'].forEach(
      (label) => expect(screen.getAllByText(label).length).toBeGreaterThan(0),
    );
  });

  it('shows officer navigation on /nodal-officer routes', () => {
    renderAt('/nodal-officer');
    expect(screen.getAllByText('My Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Submit Data').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nodal Officers')).not.toBeInTheDocument();
  });

  it('navigates between pages using the sidebar', async () => {
    renderAt('/admin');
    await userEvent.click(screen.getAllByText('Organogram')[0]);
    expect(await screen.findByText('Organogram Content')).toBeInTheDocument();
  });

  it('links back to the public portal', async () => {
    renderAt('/admin');
    await userEvent.click(screen.getByText('Public Portal'));
    expect(await screen.findByText('Public Landing')).toBeInTheDocument();
  });

  it('shows default admin identity when nobody is logged in', async () => {
    renderAt('/admin');
    await userEvent.click(screen.getByText('AD'));
    expect(screen.getByText('DORA Admin')).toBeInTheDocument();
    expect(screen.getByText('admin@iitmandi.ac.in')).toBeInTheDocument();
  });

  it('shows the logged-in user from localStorage', async () => {
    localStorage.setItem(
      'dora_user',
      JSON.stringify({ username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@iitmandi.ac.in', role: 'OFFICER' }),
    );
    renderAt('/admin');
    await userEvent.click(screen.getByText('JD'));
    expect(screen.getByText('jdoe')).toBeInTheDocument();
    expect(screen.getByText('jane@iitmandi.ac.in')).toBeInTheDocument();
    expect(screen.getByText('OFFICER')).toBeInTheDocument();
  });

  it('opens the notifications dropdown', async () => {
    renderAt('/admin');
    const bell = screen.getAllByRole('button').find((b) => b.querySelector('span.bg-dusty-rose-500'))!;
    await userEvent.click(bell);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Submission Received')).toBeInTheDocument();
  });

  it('sign out clears the session and returns to the public landing page', async () => {
    localStorage.setItem('dora_access_token', 'a');
    localStorage.setItem('dora_refresh_token', 'r');
    localStorage.setItem('dora_user', JSON.stringify({ username: 'x' }));
    renderAt('/admin');
    await userEvent.click(screen.getByText('AD'));
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText('Public Landing')).toBeInTheDocument();
    expect(localStorage.getItem('dora_access_token')).toBeNull();
    expect(localStorage.getItem('dora_refresh_token')).toBeNull();
    expect(localStorage.getItem('dora_user')).toBeNull();
  });
});
