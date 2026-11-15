import { context, propagation, SpanKind, trace, TraceFlags } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { closedPortUrl, outcomeWithin, startSilentServer } from '../test/tcp-proxy.js';
import { startTracing, type Tracing } from './tracing.js';

const FLUSH_LIMIT_MS = DEPENDENCY_LIMITS.traceExportTimeoutMs + 1000;

const UNDELAYED_MS = 50;

type Collector = { url: string; close: () => Promise<void> };

const refusingCollector = async (): Promise<Collector> => ({
  url: await closedPortUrl(),
  close: () => Promise.resolve(),
});

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
  trace.disable();
  propagation.disable();
  context.disable();
  vi.unstubAllEnvs();
});

function tracedRequest(): Promise<number> {
  return trace.getTracer('probe').startActiveSpan('POST', { kind: SpanKind.SERVER }, (span) => {
    span.end();
    return Promise.resolve(span.spanContext().traceFlags);
  });
}

function started(tracing: Tracing | undefined): Tracing {
  if (tracing === undefined) throw new Error('tracing did not start with an endpoint set');
  cleanups.push(() => tracing.shutdown());
  return tracing;
}

describe('startTracing', () => {
  it('starts no SDK while OTEL_EXPORTER_OTLP_ENDPOINT is empty, so a request span is not sampled', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');

    expect(startTracing({ service: 'api' })).toBeUndefined();
    expect(await tracedRequest()).toBe(TraceFlags.NONE);
  });

  it.each([
    { collector: 'refuses the connection', start: refusingCollector },
    { collector: 'accepts the connection and never answers', start: startSilentServer },
  ])(
    'samples a request span without delaying it and settles a flush within the export limit while the collector $collector',
    { timeout: FLUSH_LIMIT_MS + 5000 },
    async ({ start }) => {
      const collector = await start();
      cleanups.push(() => collector.close());
      vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', collector.url);
      const tracing = started(startTracing({ service: 'api' }));

      const work = tracedRequest();
      const workOutcome = await outcomeWithin(work, UNDELAYED_MS);
      const flush = await outcomeWithin(tracing.forceFlush(), FLUSH_LIMIT_MS);

      expect([workOutcome, await work]).toEqual(['answered', TraceFlags.SAMPLED]);
      expect(flush).not.toBe('still pending');
    },
  );
});
