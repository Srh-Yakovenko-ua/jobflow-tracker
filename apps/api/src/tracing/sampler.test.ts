import { type Context, ROOT_CONTEXT, SpanKind, trace, TraceFlags } from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace';
import { describe, expect, it } from 'vitest';

import { REMOTE_PARENT } from '../test/tracing.js';
import { traceSampler } from './sampler.js';

const SAMPLED_REMOTE_PARENT = trace.setSpanContext(ROOT_CONTEXT, {
  traceId: REMOTE_PARENT.traceId,
  spanId: REMOTE_PARENT.spanId,
  traceFlags: TraceFlags.SAMPLED,
  isRemote: true,
});

type SampledSpan = { name: string; kind: SpanKind; parent?: Context };

function decisionOf({ name, kind, parent = ROOT_CONTEXT }: SampledSpan): SamplingDecision {
  return traceSampler.shouldSample(parent, REMOTE_PARENT.traceId, name, kind, {}, []).decision;
}

describe('traceSampler', () => {
  it.each([
    { root: 'a SERVER span of an incoming request', name: 'POST', kind: SpanKind.SERVER },
    { root: 'a CONSUMER span of the ai queue', name: 'process ai', kind: SpanKind.CONSUMER },
  ])('records $root as a new trace', (span) => {
    expect(decisionOf(span)).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it.each([
    { root: "BullMQ's INTERNAL getNextJob", name: 'getNextJob ai', kind: SpanKind.INTERNAL },
    { root: 'an orphan Redis CLIENT span', name: 'get', kind: SpanKind.CLIENT },
    { root: 'the maintenance tick', name: 'process maintenance', kind: SpanKind.CONSUMER },
  ])('drops $root without a parent', (span) => {
    expect(decisionOf(span)).toBe(SamplingDecision.NOT_RECORD);
  });

  it('records an INTERNAL span under a sampled remote parent', () => {
    const child = { name: 'outbox.relay', kind: SpanKind.INTERNAL, parent: SAMPLED_REMOTE_PARENT };

    expect(decisionOf(child)).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });
});
