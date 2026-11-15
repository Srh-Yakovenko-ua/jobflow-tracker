import {
  type Attributes,
  context,
  isSpanContextValid,
  propagation,
  ROOT_CONTEXT,
  type Span,
  trace,
  TraceFlags,
} from '@opentelemetry/api';
import { z } from 'zod';

export const TRACER_NAME = 'jobflow';

export type TraceCarrier = { traceparent?: string };

export type TraceFields = { trace_id?: string; span_id?: string };

export type ChildSpan = { name: string; traceparent: string; attributes: Attributes };

export const tracedMessageSchema = z.object({ traceparent: z.string().min(1) });

export function traceCarrier(): TraceCarrier {
  const carrier: Partial<Record<string, string>> = {};
  propagation.inject(context.active(), carrier);
  const { traceparent } = carrier;
  return traceparent === undefined ? {} : { traceparent };
}

export function traceFields(): TraceFields {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (spanContext === undefined || !isSpanContextValid(spanContext)) {
    return {};
  }
  if ((spanContext.traceFlags & TraceFlags.SAMPLED) === 0) {
    return {};
  }
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

export function childSpanOf({ name, traceparent, attributes }: ChildSpan): Span {
  const parent = propagation.extract(ROOT_CONTEXT, { traceparent });
  return trace.getTracer(TRACER_NAME).startSpan(name, { attributes }, parent);
}

export function inChildSpan<Result>(child: ChildSpan, work: () => Result): Result {
  const span = childSpanOf(child);
  try {
    return context.with(trace.setSpan(context.active(), span), work);
  } finally {
    span.end();
  }
}
