import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REPORTS_TO, stubErrorTrackingEnv, unsetErrorTracking } from '@/test/error-reports';

async function registered() {
  const instrumentation = await import('./instrumentation');
  instrumentation.register();
  return instrumentation;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(async () => {
  await unsetErrorTracking();
});

describe('instrumentation', () => {
  it('reports server crashes from the Node runtime to the configured DSN under the release', async () => {
    stubErrorTrackingEnv();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');

    await registered();

    expect(Sentry.getClient()?.getOptions()).toMatchObject({
      dsn: REPORTS_TO.dsn,
      release: REPORTS_TO.release,
      maxBreadcrumbs: 0,
      enableOpenTelemetrySetup: false,
    });
  });

  it('starts nothing on the edge runtime', async () => {
    stubErrorTrackingEnv();
    vi.stubEnv('NEXT_RUNTIME', 'edge');

    await registered();

    expect(Sentry.getClient()).toBeUndefined();
  });

  it('starts nothing when no DSN is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');

    await registered();

    expect(Sentry.getClient()).toBeUndefined();
  });

  it('hands every Next request error to the SDK', async () => {
    const { onRequestError } = await registered();

    expect(onRequestError).toBe(Sentry.captureRequestError);
  });
});
