// The end-to-end run: the production build, in the memory world, so it needs no network.
// Locally, CHROMIUM and WEBKIT may name browser executables already on the machine; without
// them Playwright uses the browsers it installed (`npx playwright install chromium webkit`).
// E2E_URL points the run at a server that is already up, such as the dev server.

import { defineConfig } from '@playwright/test'

const url = process.env.E2E_URL ?? 'http://localhost:5181'
const executable = (path: string | undefined) => (path ? { launchOptions: { executablePath: path } } : {})

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: url, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', ...executable(process.env.CHROMIUM) } },
    ...(process.env.WEBKIT || process.env.CI ? [{ name: 'webkit', use: { browserName: 'webkit' as const, ...executable(process.env.WEBKIT) } }] : []),
  ],
  ...(process.env.E2E_URL ? {} : { webServer: { command: 'npm run build && npm run preview', url, reuseExistingServer: false, timeout: 120_000 } }),
})
