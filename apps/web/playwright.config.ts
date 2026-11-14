import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI !== undefined && process.env.CI !== '';

const BOOKMARKLET_SPEC = /bookmarklet\.test\.ts$/;

const E2E_LIMITS = { globalTimeoutMs: 6 * 60_000, testTimeoutMs: 150_000, ciWorkers: 2 } as const;

export default defineConfig({
  testDir: 'e2e',
  timeout: E2E_LIMITS.testTimeoutMs,
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  ...(CI ? { workers: E2E_LIMITS.ciWorkers, globalTimeout: E2E_LIMITS.globalTimeoutMs } : {}),
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    locale: 'uk-UA',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: BOOKMARKLET_SPEC,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: BOOKMARKLET_SPEC,
    },
  ],
});
