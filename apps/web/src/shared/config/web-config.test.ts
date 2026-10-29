import { describe, expect, it } from 'vitest';

import { parseWebConfig } from './web-config';

describe('parseWebConfig', () => {
  it('falls back to the local API and analytics ports when nothing is set', () => {
    expect(parseWebConfig({})).toEqual({
      apiBaseUrl: 'http://localhost:4000/api/v1',
      analyticsBaseUrl: 'http://localhost:8000',
    });
  });

  it('joins /api/v1 to the given API origin without a double slash', () => {
    const config = parseWebConfig({
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4100/',
      NEXT_PUBLIC_ANALYTICS_URL: 'https://analytics.test/',
    });

    expect(config).toEqual({
      apiBaseUrl: 'http://127.0.0.1:4100/api/v1',
      analyticsBaseUrl: 'https://analytics.test',
    });
  });

  it.each([
    ['NEXT_PUBLIC_API_URL', 'ftp://x'],
    ['NEXT_PUBLIC_ANALYTICS_URL', 'not a url'],
  ])('refuses a malformed %s and names it', (key, value) => {
    expect(() => parseWebConfig({ [key]: value })).toThrow(key);
  });
});
