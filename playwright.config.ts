import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 3100);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // a retry would hide flake; flaky tests are fixed, not retried
  workers: process.env.CI ? 2 : undefined,
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
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    env: { PORT: String(PORT) },
  },
});
