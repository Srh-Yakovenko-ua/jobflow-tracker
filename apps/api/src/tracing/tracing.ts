import { register } from 'node:module';

import { SpanKind } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import {
  HttpInstrumentation,
  type HttpInstrumentationConfig,
} from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace';
import { ATTR_URL_FULL, ATTR_URL_PATH, ATTR_URL_QUERY } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';

import { QUIET_PATHS, withoutQuery } from '../common/logger.js';
import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { loadProcessEnv } from '../config/env.js';
import { METRICS_PATH } from '../metrics/metrics-endpoint.js';
import { redactedClientUrl, redactedPath } from './client-url.js';
import { Nest12Instrumentation } from './nest-instrumentation.js';
import { traceSampler } from './sampler.js';

export type TracedService = 'api' | 'worker';

export type Tracing = { forceFlush(): Promise<void>; shutdown(): Promise<void> };

const UNTRACED_PATHS: ReadonlySet<string> = new Set([...QUIET_PATHS, METRICS_PATH]);

const REDACTED_QUERY = 'REDACTED';

export const HTTP_TRACE_OPTIONS: HttpInstrumentationConfig = {
  ignoreIncomingRequestHook: (request) => UNTRACED_PATHS.has(withoutQuery(request.url ?? '')),
  requestHook: (span, request) => {
    if (
      'url' in request &&
      request.url !== undefined &&
      request.url !== withoutQuery(request.url)
    ) {
      span.setAttribute(ATTR_URL_QUERY, REDACTED_QUERY);
    }
  },
};

type StartedSpan = Parameters<SpanProcessor['onStart']>[0];

const textOf = (span: StartedSpan, key: string): string | undefined => {
  const value = span.attributes[key];
  return typeof value === 'string' ? value : undefined;
};

function redactClientSpan(span: StartedSpan): void {
  const url = textOf(span, ATTR_URL_FULL);
  const path = textOf(span, ATTR_URL_PATH);
  const query = textOf(span, ATTR_URL_QUERY);
  if (url !== undefined) span.setAttribute(ATTR_URL_FULL, redactedClientUrl(url));
  if (path !== undefined) span.setAttribute(ATTR_URL_PATH, redactedPath(path));
  if (query !== undefined && query !== '') span.setAttribute(ATTR_URL_QUERY, REDACTED_QUERY);
}

export const URL_REDACTION: SpanProcessor = {
  onStart: (span) => {
    if (span.kind === SpanKind.CLIENT) {
      redactClientSpan(span);
      return;
    }
    const url = textOf(span, ATTR_URL_FULL);
    if (url !== undefined) span.setAttribute(ATTR_URL_FULL, withoutQuery(url));
  },
  onEnd: () => undefined,
  forceFlush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
};

function instrumentations(): Instrumentation[] {
  return [
    new HttpInstrumentation(HTTP_TRACE_OPTIONS),
    new ExpressInstrumentation(),
    new Nest12Instrumentation(),
    new IORedisInstrumentation({
      requireParentSpan: true,
      dbStatementSerializer: (command) => command,
    }),
    new PgInstrumentation({ requireParentSpan: true }),
    new UndiciInstrumentation(),
    new PrismaInstrumentation(),
  ];
}

function spanProcessorFor(endpoint: string): BatchSpanProcessor {
  const timeoutMillis = DEPENDENCY_LIMITS.traceExportTimeoutMs;
  const exporter = new OTLPTraceExporter({
    url: new URL('/v1/traces', endpoint).href,
    timeoutMillis,
  });
  return new BatchSpanProcessor({ exporter, exportTimeoutMillis: timeoutMillis });
}

export function registerInstrumentationHook(): void {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
}

export function startTracing({ service }: { service: TracedService }): Tracing | undefined {
  const endpoint = loadProcessEnv().OTEL_EXPORTER_OTLP_ENDPOINT;
  if (endpoint === undefined) {
    return undefined;
  }
  registerInstrumentationHook();
  const processor = spanProcessorFor(endpoint);
  const sdk = new NodeSDK({
    serviceName: service,
    sampler: traceSampler,
    spanProcessors: [URL_REDACTION, processor],
    metricReaders: [],
    logRecordProcessors: [],
    instrumentations: instrumentations(),
  });
  sdk.start();
  return { forceFlush: () => processor.forceFlush(), shutdown: () => sdk.shutdown() };
}
