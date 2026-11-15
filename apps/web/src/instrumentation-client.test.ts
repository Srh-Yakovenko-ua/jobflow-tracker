import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { REPORTS_TO, stubErrorTrackingEnv, unsetErrorTracking } from '@/test/error-reports';

beforeEach(() => {
  vi.resetModules();
});

afterEach(async () => {
  await unsetErrorTracking();
});

describe('instrumentation-client', () => {
  it('turns zod JIT off on the client, so no new Function probe meets the CSP', async () => {
    await import('./instrumentation-client');

    expect(z.config().jitless).toBe(true);
  });

  it('reports browser crashes to the configured DSN under the release, without breadcrumbs', async () => {
    stubErrorTrackingEnv();

    await import('./instrumentation-client');

    expect(Sentry.getClient()?.getOptions()).toMatchObject({
      dsn: REPORTS_TO.dsn,
      release: REPORTS_TO.release,
      maxBreadcrumbs: 0,
    });
  });

  it('sends nothing when no DSN is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');

    await import('./instrumentation-client');

    expect(Sentry.getClient()).toBeUndefined();
  });
});
