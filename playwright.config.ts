import { defineConfig, devices } from '@playwright/test'

// E2E runs against the production server serving the built client, backed by an
// ephemeral in-memory database (STANDARDS §7.6). Run `npm run e2e` (which builds
// first). Requires browser system libraries — `npx playwright install --with-deps`.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'SECRETS_DB_PATH=:memory: PORT=8787 npm run server',
    url: 'http://localhost:8787/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
