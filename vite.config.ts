import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

import framework from './framework/plugin/index.mjs';

const runtime = path.resolve(import.meta.dirname, 'framework/runtime/index.ts');

export default defineConfig({
  // GitHub Pages serves the app under the repository's name; the workflow sets it.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), framework({ root: 'src', runtime })],
  preview: { port: 5181, strictPort: true },
  resolve: {
    alias: [
      { find: 'framework/testing', replacement: path.resolve(import.meta.dirname, 'framework/runtime/testing.ts') },
      { find: 'framework', replacement: runtime },
    ],
  },
  server: { port: 5180, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'framework/runtime/__tests__/*.test.{ts,tsx}'],
  },
});
