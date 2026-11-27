import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const VENDOR_CHUNKS: Array<{
  chunk: string;
  exact?: ReadonlySet<string>;
  prefixes?: readonly string[];
}> = [
  {
    chunk: 'vendor-react',
    exact: new Set([
      'react',
      'react-dom',
      'scheduler',
      'react-router',
      'react-router-dom',
    ]),
    prefixes: ['@remix-run/'],
  },
  {
    chunk: 'vendor-query',
    prefixes: ['@tanstack/'],
  },
  {
    chunk: 'vendor-icons',
    exact: new Set(['lucide-react']),
    prefixes: ['@phosphor-icons/'],
  },
  {
    chunk: 'vendor-motion',
    exact: new Set(['motion', 'motion-dom', 'framer-motion', 'motion-utils']),
  },
  {
    chunk: 'vendor-charts',
    exact: new Set([
      'recharts',
      'victory-vendor',
      'internmap',
      'es-toolkit',
      'decimal.js-light',
      'eventemitter3',
      '@reduxjs/toolkit',
      'redux',
      'redux-thunk',
      'react-redux',
      'reselect',
      'immer',
      'use-sync-external-store',
      'tiny-invariant',
      'react-is',
    ]),
    prefixes: ['d3-'],
  },
];

/** Extracts the npm package name (including scope) from a resolved module ID. */
function extractPackageName(id: string): string | null {
  const normalized = id.replace(/\\/g, '/');
  const marker = '/node_modules/';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return null;

  const segments = normalized.slice(idx + marker.length).split('/');
  return segments[0].startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/** Maps third-party npm packages to cacheable vendor chunks under 500 kB. */
function resolveVendorChunk(id: string): string | undefined {
  const pkgName = extractPackageName(id);
  if (!pkgName) return undefined;

  for (const group of VENDOR_CHUNKS) {
    if (group.exact?.has(pkgName)) return group.chunk;
    if (group.prefixes?.some((prefix) => pkgName.startsWith(prefix))) return group.chunk;
  }
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveVendorChunk,
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
