import { defineConfig, devices } from '@playwright/test';

import base from './playwright.config';

const WEB_URL = process.env.THESIS_WEB_URL;

export default defineConfig({
  ...base,
  testMatch: /\.shot\.ts$/,
  reporter: 'list',
  ...(WEB_URL === undefined ? {} : { use: { ...base.use, baseURL: WEB_URL } }),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
