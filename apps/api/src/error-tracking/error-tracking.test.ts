import * as Sentry from '@sentry/node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { ERROR_LEAK, type ErrorCollector, startErrorCollector } from '../test/error-collector.js';
import { startErrorTracking } from './error-tracking.js';

const RELEASE = '59dbb20a6f1c4e2b8d3a7f9e0c1b2d3e4f5a6b7c';

let collector: ErrorCollector | undefined;

afterEach(async () => {
  await Sentry.close(DEPENDENCY_LIMITS.errorReportTimeoutMs);
  await collector?.close();
  vi.unstubAllEnvs();
});

async function capturedEnvelope(error: Error): Promise<string> {
  collector = await startErrorCollector();
  vi.stubEnv('SENTRY_DSN', collector.dsn);
  vi.stubEnv('SENTRY_RELEASE', RELEASE);
  expect(startErrorTracking({ service: 'worker' })).toBeDefined();
  Sentry.captureException(error);
  await Sentry.flush(DEPENDENCY_LIMITS.errorReportTimeoutMs);
  const [envelope = '', ...others] = collector.events();
  expect(others).toEqual([]);
  return envelope;
}

describe('startErrorTracking', () => {
  it('starts no client while SENTRY_DSN is empty, so a captured error goes nowhere', () => {
    vi.stubEnv('SENTRY_DSN', '');

    expect(startErrorTracking({ service: 'api' })).toBeUndefined();
    expect(Sentry.getClient()).toBeUndefined();
  });

  it('sends a crash with its type, stack, release and service, and no email or note text from its message', async () => {
    const envelope = await capturedEnvelope(
      new TypeError(`cannot read the reply for ${ERROR_LEAK.email}: ${ERROR_LEAK.note}`),
    );

    expect(envelope).toContain('"type":"TypeError"');
    expect(envelope).toContain('error-tracking.test.ts');
    expect(envelope).toContain(`"release":"${RELEASE}"`);
    expect(envelope).toContain('"service":"worker"');
    expect(envelope).not.toContain(ERROR_LEAK.email);
    expect(envelope).not.toContain(ERROR_LEAK.note);
  });
});
