/**
 * LoginModal component – unit + interaction tests.
 *
 * Tests:
 *  - Renders modal title
 *  - Renders email and password fields
 *  - Renders all 4 role preset buttons
 *  - Clicking a role preset updates the email field
 *  - Clicking close fires onClose
 *  - Submitting the form fires onLoginSuccess with correct user shape
 *  - Default selected role is "Super Admin"
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal } from '../components/LoginModal';
import type { User } from '../types';

const defaultProps = {
  onClose: vi.fn(),
  onLoginSuccess: vi.fn(),
};

function setup(props: Partial<typeof defaultProps> = {}) {
  return render(<LoginModal {...{ ...defaultProps, ...props }} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginModal', () => {
  it('renders the modal title', () => {
    setup();
    expect(screen.getByText('IIT Mandi Admin Login')).toBeInTheDocument();
  });

  it('renders "Institutional Email" and "Password" labels', () => {
    setup();
    expect(screen.getByText(/Institutional Email/i)).toBeInTheDocument();
    expect(screen.getByText(/Password/i)).toBeInTheDocument();
  });

  it('renders all 4 role preset options', () => {
    setup();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Ranking Admin')).toBeInTheDocument();
    expect(screen.getByText('Data Entry Operator')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('defaults to Super Admin role and shows director email', () => {
    setup();
    const emailInput = screen.getByDisplayValue('director@iitmandi.ac.in');
    expect(emailInput).toBeInTheDocument();
  });

  it('updates email when a different role preset is selected', async () => {
    setup();
    const rankingAdminBtn = screen.getByRole('button', { name: /Ranking Admin/i });
    await userEvent.click(rankingAdminBtn);
    expect(screen.getByDisplayValue('ranking.cell@iitmandi.ac.in')).toBeInTheDocument();
  });

  it('calls onClose when the X button is clicked', async () => {
    const onClose = vi.fn();
    setup({ onClose });
    // Header close button has an X icon
    const allButtons = screen.getAllByRole('button');
    const xButton = allButtons.find((b) => b.querySelector('svg') && !b.textContent?.trim());
    if (xButton) {
      await userEvent.click(xButton);
    } else {
      await userEvent.click(allButtons[0]);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onLoginSuccess with correct shape on form submit', async () => {
    const onLoginSuccess = vi.fn();
    setup({ onLoginSuccess });

    const submitBtn = screen.getByRole('button', { name: /Sign In as Super Admin/i });
    await userEvent.click(submitBtn);

    expect(onLoginSuccess).toHaveBeenCalledOnce();
    const user: User = onLoginSuccess.mock.calls[0][0];
    expect(user.name).toBe('Prof. Director');
    expect(user.email).toBe('director@iitmandi.ac.in');
    expect(user.role).toBe('Super Admin');
  });

  it('updates submit button label when role changes', async () => {
    setup();
    const viewerBtn = screen.getByRole('button', { name: /Viewer/i });
    await userEvent.click(viewerBtn);
    expect(screen.getByRole('button', { name: /Sign In as Viewer/i })).toBeInTheDocument();
  });
});
