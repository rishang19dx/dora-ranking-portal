/**
 * Header component – unit + interaction tests.
 *
 * Tests:
 *  - Renders IIT Mandi branding
 *  - Renders "Admin Login" button when no user is logged in
 *  - Renders user name + "Exit Admin" button when user is provided
 *  - Search input calls setSearchQuery on change
 *  - Pressing Enter in search calls onSearchSubmit
 *  - Clicking "Admin Login" calls onOpenAdminLogin
 *  - Clicking "Exit Admin" calls onLogout
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../components/Header';

const defaultProps: React.ComponentProps<typeof Header> = {
  currentUser: null,
  onOpenAdminLogin: vi.fn(),
  onLogout: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  onSearchSubmit: vi.fn(),
};

function setup(props: Partial<React.ComponentProps<typeof Header>> = {}) {
  const merged = { ...defaultProps, ...props };
  return render(<Header {...merged} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Header', () => {
  it('renders the IIT Mandi portal title', () => {
    setup();
    expect(screen.getByText('IIT Mandi Ranking Portal')).toBeInTheDocument();
  });

  it('renders institutional Hindi text banner', () => {
    setup();
    expect(
      screen.getByText(/Indian Institute of Technology Mandi/i)
    ).toBeInTheDocument();
  });

  it('shows "Admin Login" button when no user is logged in', () => {
    setup();
    expect(screen.getByRole('button', { name: /Admin Login/i })).toBeInTheDocument();
  });

  it('calls onOpenAdminLogin when "Admin Login" is clicked', async () => {
    const onOpenAdminLogin = vi.fn();
    setup({ onOpenAdminLogin });
    await userEvent.click(screen.getByRole('button', { name: /Admin Login/i }));
    expect(onOpenAdminLogin).toHaveBeenCalledOnce();
  });

  it('shows user name and Exit Admin button when user is provided', () => {
    setup({
      currentUser: {
        name: 'Prof. Director',
        email: 'director@iitmandi.ac.in',
        role: 'Super Admin',
      },
    });
    expect(screen.getByText('Prof. Director')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exit Admin/i })).toBeInTheDocument();
  });

  it('calls onLogout when "Exit Admin" is clicked', async () => {
    const onLogout = vi.fn();
    setup({
      currentUser: {
        name: 'Prof. Director',
        email: 'director@iitmandi.ac.in',
        role: 'Super Admin',
      },
      onLogout,
    });
    await userEvent.click(screen.getByRole('button', { name: /Exit Admin/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('calls setSearchQuery when typing in the search input', async () => {
    const setSearchQuery = vi.fn();
    setup({ setSearchQuery });
    const input = screen.getByPlaceholderText(/Search rankings/i);
    await userEvent.type(input, 'NIRF');
    expect(setSearchQuery).toHaveBeenCalled();
  });

  it('calls onSearchSubmit when Enter is pressed in search input', () => {
    const onSearchSubmit = vi.fn();
    setup({ onSearchSubmit, searchQuery: 'test query' });
    const input = screen.getByPlaceholderText(/Search rankings/i);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onSearchSubmit).toHaveBeenCalledOnce();
  });

  it('renders NIRF / QS / THE badge', () => {
    setup();
    expect(screen.getByText('NIRF / QS / THE')).toBeInTheDocument();
  });

  it('renders link to IIT Mandi main site', () => {
    setup();
    const link = screen.getByRole('link', { name: /IIT Mandi Main Site/i });
    expect(link).toHaveAttribute('href', 'https://www.iitmandi.ac.in');
  });
});
