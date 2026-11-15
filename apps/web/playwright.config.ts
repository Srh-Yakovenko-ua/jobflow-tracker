import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI !== undefined && process.env.CI !== '';

const BOOKMARKLET_SPEC = /bookmarklet\.test\.ts$/;

const PUSH_SPEC = /push\.test\.ts$/;

const PUSH_DELIVERY_SPEC = /push-delivery\.test\.ts$/;

const LIGHTHOUSE_SPEC = /lighthouse\.test\.ts$/;

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
      testIgnore: [BOOKMARKLET_SPEC, PUSH_SPEC, PUSH_DELIVERY_SPEC, LIGHTHOUSE_SPEC],
    },
    { name: 'lighthouse', testMatch: LIGHTHOUSE_SPEC },
    {
      name: 'chromium-push',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
      testMatch: [PUSH_SPEC, PUSH_DELIVERY_SPEC],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: [BOOKMARKLET_SPEC, PUSH_SPEC],
    },
  ],
});
