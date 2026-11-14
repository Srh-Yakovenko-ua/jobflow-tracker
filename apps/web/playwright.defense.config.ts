import { defineConfig } from '@playwright/test';

import thesis from './playwright.thesis.config';

const SCREEN = { width: 1440, height: 900 } as const;

const DEFENSE = { testTimeoutMs: 6 * 60_000, slowMoMs: 300 } as const;

export default defineConfig({
  ...thesis,
  testMatch: /\.walk\.ts$/,
  timeout: DEFENSE.testTimeoutMs,
  use: {
    ...thesis.use,
    viewport: SCREEN,
    video: { mode: 'on', size: SCREEN },
    reducedMotion: 'no-preference',
    launchOptions: { slowMo: DEFENSE.slowMoMs },
  },
  webServer: {
    command: 'python3 -m http.server 8090 --bind 127.0.0.1 --directory ../../docs/defense',
    url: 'http://127.0.0.1:8090/vacancy.html',
    reuseExistingServer: true,
  },
});
