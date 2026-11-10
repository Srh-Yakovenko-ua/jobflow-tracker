import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

describe('next config', () => {
  it('answers an RSC request for a page that failed to load without the cache-busting redirect', () => {
    expect(nextConfig.experimental?.validateRSCRequestHeaders).toBe(false);
  });
});
