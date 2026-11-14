import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

describe('next config', () => {
  it('answers an RSC request for a page that failed to load without the cache-busting redirect', () => {
    expect(nextConfig.experimental?.validateRSCRequestHeaders).toBe(false);
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
