import { describe, expect, it } from 'vitest';

import { insideSpan, recordSpans, REMOTE_PARENT, traceparentOf } from '../test/tracing.js';
import { childSpanOf, traceCarrier, traceFields } from './trace-context.js';

const spans = recordSpans();

describe('traceCarrier', () => {
  it('carries the active span as a W3C traceparent', async () => {
    const { carrier, spanContext } = await insideSpan((span) => ({
      carrier: traceCarrier(),
      spanContext: span.spanContext(),
    }));

    expect(carrier).toEqual({ traceparent: traceparentOf(spanContext) });
  });

  it('carries nothing without an active span', () => {
    expect(traceCarrier()).toEqual({});
  });
});

describe('traceFields', () => {
  it('names the active trace and span for a log line', async () => {
    const { fields, spanContext } = await insideSpan((span) => ({
      fields: traceFields(),
      spanContext: span.spanContext(),
    }));

    expect(fields).toEqual({ trace_id: spanContext.traceId, span_id: spanContext.spanId });
  });

  it('adds no field without an active span', () => {
    expect(traceFields()).toEqual({});
  });
});

describe('childSpanOf', () => {
  it('starts a span under the remote parent a traceparent names, with its attributes', async () => {
    childSpanOf({
      name: 'outbox.relay',
      traceparent: REMOTE_PARENT.traceparent,
      attributes: { 'outbox.id': 'row-1' },
    }).end();

    const [relayed] = await spans.named('outbox.relay');
    expect(relayed?.spanContext().traceId).toBe(REMOTE_PARENT.traceId);
    expect(relayed?.parentSpanContext?.spanId).toBe(REMOTE_PARENT.spanId);
    expect(relayed?.attributes).toEqual({ 'outbox.id': 'row-1' });
  });
});
