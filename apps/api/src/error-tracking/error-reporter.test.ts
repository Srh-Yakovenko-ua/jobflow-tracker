import { Test, type TestingModule } from '@nestjs/testing';
import * as Sentry from '@sentry/node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { dsnAt, ERROR_LEAK, startErrorCollector } from '../test/error-collector.js';
import { closedPortUrl, outcomeWithin, startSilentServer } from '../test/tcp-proxy.js';
import { ErrorReporter } from './error-reporter.js';
import { startErrorTracking } from './error-tracking.js';
import { ErrorTrackingModule } from './error-tracking.module.js';

const CLOSE_LIMIT_MS = DEPENDENCY_LIMITS.errorReportTimeoutMs + 1000;

const UNDELAYED_MS = 50;

type GlitchTip = { dsn: string; close: () => Promise<void> };

const refusingGlitchTip = async (): Promise<GlitchTip> => ({
  dsn: dsnAt(await closedPortUrl()),
  close: () => Promise.resolve(),
});

const silentGlitchTip = async (): Promise<GlitchTip> => {
  const server = await startSilentServer();
  return { dsn: dsnAt(server.url), close: server.close };
};

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
  vi.unstubAllEnvs();
});

async function reportingTo(glitchTip: GlitchTip): Promise<TestingModule> {
  cleanups.push(() => glitchTip.close());
  vi.stubEnv('SENTRY_DSN', glitchTip.dsn);
  startErrorTracking({ service: 'api' });
  const moduleRef = await Test.createTestingModule({ imports: [ErrorTrackingModule] }).compile();
  cleanups.push(() => moduleRef.close());
  return moduleRef;
}

const leakingFailure = () => new Error(`${ERROR_LEAK.email} ${ERROR_LEAK.note}`);

describe('ErrorReporter', () => {
  it('sends a reported failure with its tags and without the email or note text', async () => {
    const collector = await startErrorCollector();
    const moduleRef = await reportingTo(collector);

    moduleRef.get(ErrorReporter).capture({
      exception: leakingFailure(),
      tags: { requestId: 'req-5f3a9c0e' },
    });
    await Sentry.flush(DEPENDENCY_LIMITS.errorReportTimeoutMs);
    const envelopes = collector.events().join('\n');

    expect(collector.events()).toHaveLength(1);
    expect(envelopes).toContain('"requestId":"req-5f3a9c0e"');
    expect(envelopes).not.toContain(ERROR_LEAK.email);
    expect(envelopes).not.toContain(ERROR_LEAK.note);
  });

  it.each([
    { glitchTip: 'refuses the connection', start: refusingGlitchTip },
    { glitchTip: 'accepts the connection and never answers', start: silentGlitchTip },
  ])(
    'returns from a capture at once and shuts down within the report limit while GlitchTip $glitchTip',
    { timeout: CLOSE_LIMIT_MS + 5000 },
    async ({ start }) => {
      const moduleRef = await reportingTo(await start());

      const startedAt = performance.now();
      moduleRef.get(ErrorReporter).capture({ exception: leakingFailure(), tags: {} });
      const captureMs = performance.now() - startedAt;
      const shutdown = await outcomeWithin(moduleRef.close(), CLOSE_LIMIT_MS);

      expect(captureMs).toBeLessThan(UNDELAYED_MS);
      expect(shutdown).toBe('answered');
    },
  );
});
