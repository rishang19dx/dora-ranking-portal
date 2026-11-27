/**
 * ToastProvider – unit tests for showToast and auto-dismiss.
 *
 * Tests:
 *  - showToast('msg', 'success') renders a success toast with the message
 *  - showToast('msg', 'error') renders an error toast
 *  - showToast('msg', 'info') renders an info toast (default)
 *  - Clicking the X on a toast removes it immediately
 *  - Multiple toasts can be shown simultaneously
 *  - useToast throws if used outside provider
 */

import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../components/ToastProvider';

// ---------------------------------------------------------------------------
// Helper: a component that fires showToast on mount.
// ---------------------------------------------------------------------------
interface TriggerProps {
  message: string;
  type?: 'success' | 'error' | 'info';
}
function ToastTrigger({ message, type }: TriggerProps) {
  const { showToast } = useToast();
  useEffect(() => {
    showToast(message, type);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderToast(message: string, type?: 'success' | 'error' | 'info') {
  return render(
    <ToastProvider>
      <ToastTrigger message={message} type={type} />
    </ToastProvider>
  );
}

beforeEach(() => {
  // shouldAdvanceTime lets RTL's waitFor keep polling while timers are faked.
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('renders a success toast with the given message', async () => {
    renderToast('Operation completed!', 'success');
    await waitFor(() => {
      expect(screen.getByText('Operation completed!')).toBeInTheDocument();
    });
  });

  it('renders an error toast with the given message', async () => {
    renderToast('Something went wrong.', 'error');
    await waitFor(() => {
      expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    });
  });

  it('renders an info toast (default) when no type is supplied', async () => {
    renderToast('FYI: data is loading.');
    await waitFor(() => {
      expect(screen.getByText('FYI: data is loading.')).toBeInTheDocument();
    });
  });

  it('removes the toast after the auto-dismiss timeout (4 s)', async () => {
    renderToast('Auto dismiss me', 'info');
    await waitFor(() => {
      expect(screen.getByText('Auto dismiss me')).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(4100);
    });

    // Note: motion/react AnimatePresence uses animation exit — in jsdom the
    // element may linger in the exit animation state, so we check that the
    // DOM no longer shows the message OR that it has the exit class applied.
    // We'll wait a tick after advancing timers.
    await waitFor(() => {
      expect(screen.queryByText('Auto dismiss me')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('removes toast immediately when the X button is clicked', async () => {
    renderToast('Click X to close', 'success');
    await waitFor(() => {
      expect(screen.getByText('Click X to close')).toBeInTheDocument();
    });

    // Find the dismiss button — it's the button that wraps the X icon
    const closeButtons = screen.getAllByRole('button');
    await userEvent.click(closeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Click X to close')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('can display multiple toasts simultaneously', async () => {
    function MultiTrigger() {
      const { showToast } = useToast();
      useEffect(() => {
        showToast('First toast', 'success');
        showToast('Second toast', 'error');
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }

    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('First toast')).toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
    });
  });

  it('throws if useToast is used outside ToastProvider', () => {
    // Suppress React error boundary noise in test output
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Broken() {
      useToast(); // should throw
      return null;
    }

    expect(() => render(<Broken />)).toThrow('useToast must be used within ToastProvider');
    consoleError.mockRestore();
  });
});
