import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 3100);

export default defineConfig({
  testDir: './tests',
  // The demo app keeps carts, sessions and orders in one in-memory store, so
  // parallel workers race on reset. Run deterministically until the app gets
  // per-session state or a real database.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0, // a retry would hide flake; flaky tests are fixed, not retried
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node app/server.js',
    url: `http://127.0.0.1:${PORT}/api/products`,
    // Never reuse: the app's seeded-bug state is set per server start, so a
    // reused server would silently run the wrong bug configuration.
    reuseExistingServer: false,
    timeout: 20_000,
    env: { PORT: String(PORT), SEEDED_BUGS: '', QA_SEEDED_BUGS: process.env.QA_SEEDED_BUGS || '' },
  },
});
