/**
 * LoginModal: real credential sign-in (Phase 3 RBAC).
 *
 * The role is decided by the server account, never chosen in the dialog.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const login = vi.fn();
vi.mock('../services/api', () => ({
  authService: { login: (...args: unknown[]) => login(...args) },
}));

import { LoginModal } from './LoginModal';

const onClose = vi.fn();
const onLoginSuccess = vi.fn();

function setup() {
  return render(<LoginModal onClose={onClose} onLoginSuccess={onLoginSuccess} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginModal', () => {
  it('offers credential fields and no role picker', () => {
    setup();
    expect(screen.getByLabelText(/Username or institutional email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toHaveAttribute('type', 'password');
    expect(screen.queryByText(/Super Admin/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toHaveValue('');
  });

  it('signs in with what was typed and hands back the server user', async () => {
    const user = { id: 3, username: 'ira', email: 'ira@iitmandi.ac.in', role: 'AUDITOR' };
    login.mockResolvedValue({ access: 'a', refresh: 'r', user });
    setup();
    await userEvent.type(screen.getByLabelText(/Username or institutional email/i), ' ira@iitmandi.ac.in ');
    await userEvent.type(screen.getByLabelText(/Password/i), 'Secret-1');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(user));
    expect(login).toHaveBeenCalledWith('ira@iitmandi.ac.in', 'Secret-1');
  });

  it('explains a rejected password without signing in', async () => {
    login.mockRejectedValue({ response: { status: 401 } });
    setup();
    await userEvent.type(screen.getByLabelText(/Username or institutional email/i), 'x');
    await userEvent.type(screen.getByLabelText(/Password/i), 'y');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Incorrect/i);
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('explains throttling', async () => {
    login.mockRejectedValue({ response: { status: 429 } });
    setup();
    await userEvent.type(screen.getByLabelText(/Username or institutional email/i), 'x');
    await userEvent.type(screen.getByLabelText(/Password/i), 'y');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many attempts/i);
  });

  it('closes', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
