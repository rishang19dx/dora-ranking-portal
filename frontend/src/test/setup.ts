import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Ensure React Testing Library unmounts components between tests so
// assertions never leak DOM state from one test file into the next.
afterEach(() => {
  cleanup();
});
