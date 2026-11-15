import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

describe('next config', () => {
  it('answers an RSC request for a page that failed to load without the cache-busting redirect', () => {
    expect(nextConfig.experimental?.validateRSCRequestHeaders).toBe(false);
  });

  it('the dev server shows no indicator badge, so the thesis screenshots carry none', () => {
    expect(nextConfig.devIndicators).toBe(false);
  });

  it('emits browser source maps, so sentry-cli can upload them and a crash points to the TypeScript line', () => {
    expect(nextConfig.productionBrowserSourceMaps).toBe(true);
  });

  it('builds without scope hoisting, which drops the React Compiler source map and points a crash at compiler output', () => {
    expect(nextConfig.experimental?.turbopackScopeHoisting).toBe(false);
  });

  it('builds without the Turbopack build cache, which served maps from before the scope hoisting change', () => {
    expect(nextConfig.experimental?.turbopackFileSystemCacheForBuild).toBe(false);
  });

  it('sends the isolation, framing, sniffing and referrer headers on every route', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const everyRoute = rules.find((rule) => rule.source === '/:path*')?.headers ?? [];

    expect(Object.fromEntries(everyRoute.map(({ key, value }) => [key, value]))).toEqual({
      'Cross-Origin-Opener-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
  });
});
