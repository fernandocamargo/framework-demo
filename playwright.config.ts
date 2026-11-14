// The end-to-end run: the production build, in the memory world, so it needs no network.
// Locally, CHROMIUM and WEBKIT may name browser executables already on the machine; without
// them Playwright uses the browsers it installed (`npx playwright install chromium webkit`).
// E2E_URL points the run at a server that is already up, such as the dev server.

import { defineConfig } from '@playwright/test';

const url = process.env.E2E_URL ?? 'http://localhost:5181';
const executable = (path: string | undefined) => (path ? { launchOptions: { executablePath: path } } : {});

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', ...executable(process.env.CHROMIUM) } },
    ...(process.env.WEBKIT || process.env.CI
      ? [{ name: 'webkit', use: { browserName: 'webkit' as const, ...executable(process.env.WEBKIT) } }]
      : []),
  ],
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  testDir: 'e2e',
  use: { baseURL: url, trace: 'retain-on-failure' },
  ...(process.env.E2E_URL
    ? {}
    : {
        webServer: { command: 'npm run build && npm run preview', reuseExistingServer: false, timeout: 120_000, url },
      }),
});
