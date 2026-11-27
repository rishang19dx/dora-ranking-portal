/**
 * Shared test utilities for component and integration tests.
 *
 * Usage:
 *   import { renderWithProviders } from '../test/test-utils';
 *   const { getByRole } = renderWithProviders(<MyComponent />);
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ToastProvider';

// ---------------------------------------------------------------------------
// Global browser API stubs required by jsdom (Recharts uses ResizeObserver,
// various components use matchMedia / IntersectionObserver).
// These are set up once per module load — the afterEach cleanup in setup.ts
// unmounts the DOM, so the stubs only need to exist as globals.
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  // ResizeObserver – used by Recharts ResponsiveContainer
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // matchMedia – used by responsive Tailwind components
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  // IntersectionObserver – used by motion/react and visibility helpers
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class IntersectionObserver {
      constructor(public cb: IntersectionObserverCallback, public opts?: IntersectionObserverInit) {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [];
    };
  }

  // URL.createObjectURL – used by file download helpers
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:mock-url';
    window.URL.revokeObjectURL = () => {};
  }

  // scrollTo – used by Navigation tab handler
  if (!window.scrollTo) {
    window.scrollTo = () => {};
  }
}

// ---------------------------------------------------------------------------
// Factory: fresh QueryClient per test (no shared cache between tests)
// ---------------------------------------------------------------------------
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,       // fail fast in tests
        staleTime: Infinity, // don't refetch while test runs
      },
    },
  });
}

// ---------------------------------------------------------------------------
// renderWithProviders: drop-in replacement for RTL's render() that wraps the
// component under test in all required providers.
// ---------------------------------------------------------------------------
interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    routerProps = {},
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: RenderWithProvidersOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter {...routerProps}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
