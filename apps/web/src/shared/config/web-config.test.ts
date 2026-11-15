import { describe, expect, it } from 'vitest';

import { parseWebConfig } from './web-config';

describe('parseWebConfig', () => {
  it('falls back to the local API and analytics ports when nothing is set', () => {
    expect(parseWebConfig({})).toStrictEqual({
      errorTracking: undefined,
      apiUrl: 'http://localhost:4000',
      apiBaseUrl: 'http://localhost:4000/api/v1',
      analyticsBaseUrl: 'http://localhost:8000',
      filesUrl: 'http://localhost:9000',
    });
  });

  it('gives the bookmarklet an API origin without the trailing slash', () => {
    expect(parseWebConfig({ NEXT_PUBLIC_API_URL: 'http://localhost:4000/' }).apiUrl).toBe(
      'http://localhost:4000',
    );
  });

  it('joins /api/v1 to the given API origin without a double slash', () => {
    const config = parseWebConfig({
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4100/',
      NEXT_PUBLIC_ANALYTICS_URL: 'https://analytics.test/',
    });

    expect(config).toEqual({
      apiUrl: 'http://127.0.0.1:4100',
      apiBaseUrl: 'http://127.0.0.1:4100/api/v1',
      analyticsBaseUrl: 'https://analytics.test',
      filesUrl: 'http://localhost:9000',
    });
  });

  it('turns error tracking off when no DSN is set, even with a release', () => {
    expect(parseWebConfig({ NEXT_PUBLIC_SENTRY_RELEASE: 'abc123' }).errorTracking).toBeUndefined();
  });

  it('reports to the given DSN under the given release', () => {
    const config = parseWebConfig({
      NEXT_PUBLIC_SENTRY_DSN: 'http://public@localhost:8003/1',
      NEXT_PUBLIC_SENTRY_RELEASE: '59dbb20',
    });

    expect(config.errorTracking).toEqual({
      dsn: 'http://public@localhost:8003/1',
      release: '59dbb20',
    });
  });

  it('reports without a release when only the DSN is set', () => {
    const config = parseWebConfig({ NEXT_PUBLIC_SENTRY_DSN: 'http://public@localhost:8003/1' });

    expect(config.errorTracking).toStrictEqual({
      dsn: 'http://public@localhost:8003/1',
      release: undefined,
    });
  });

  it.each([
    ['NEXT_PUBLIC_API_URL', 'ftp://x'],
    ['NEXT_PUBLIC_ANALYTICS_URL', 'not a url'],
    ['NEXT_PUBLIC_FILES_URL', 'not a url'],
    ['NEXT_PUBLIC_SENTRY_DSN', 'not a url'],
  ])('refuses a malformed %s and names it', (key, value) => {
    expect(() => parseWebConfig({ [key]: value })).toThrow(key);
  });
});
