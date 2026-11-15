import { context, propagation, type Span, type SpanContext, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
  type SpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { afterAll, afterEach, beforeAll } from 'vitest';

export type TraceIds = Pick<SpanContext, 'traceId' | 'spanId'>;

export function traceparentOf({ traceId, spanId }: TraceIds): string {
  return `00-${traceId}-${spanId}-01`;
}

export const REMOTE_PARENT = {
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
  traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
} as const;

export type RecordedSpans = {
  finished: () => Promise<ReadableSpan[]>;
  named: (name: string) => Promise<ReadableSpan[]>;
};

export function recordSpans({
  processors = [],
}: { processors?: SpanProcessor[] } = {}): RecordedSpans {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [...processors, new SimpleSpanProcessor({ exporter })],
  });

  beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(() => {
    exporter.reset();
  });

  afterAll(() => {
    trace.disable();
    propagation.disable();
    context.disable();
  });

  const finished = async () => {
    await provider.forceFlush();
    return exporter.getFinishedSpans();
  };
  const named = async (name: string) => (await finished()).filter((span) => span.name === name);
  return { finished, named };
}

export function insideSpan<Result>(
  work: (span: Span) => Result | Promise<Result>,
): Promise<Result> {
  return trace.getTracer('test').startActiveSpan('test work', async (span) => {
    try {
      return await work(span);
    } finally {
      span.end();
    }
  });
}
