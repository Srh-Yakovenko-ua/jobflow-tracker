import { context, type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import type { JobsOptions, QueueOptions } from 'bullmq';

import { errorMessageOf } from '../common/error-message.js';
import type { Prisma } from '../generated/prisma/client.js';
import { childSpanOf } from '../tracing/trace-context.js';
import type { UnpublishedOutboxRow } from './outbox.repository.js';

export const OUTBOX_RELAY_SPAN = 'outbox.relay';

export type DomainEventJob = { name: string; data: Prisma.JsonValue; opts: JobsOptions };

export type RelayQueue = { readonly name: string; readonly opts: Partial<QueueOptions> };

export type TracedJobs = { jobs: DomainEventJob[]; spans: Span[] };

type TracedJob = { job: DomainEventJob; span?: Span };

function tracedJob(row: UnpublishedOutboxRow, queue: RelayQueue): TracedJob {
  const job = { name: row.eventType, data: row.payload, opts: { jobId: row.id } };
  if (row.traceparent === null) {
    return { job: { ...job, opts: { ...job.opts, telemetry: { omitContext: true } } } };
  }
  const span = childSpanOf({
    name: OUTBOX_RELAY_SPAN,
    traceparent: row.traceparent,
    attributes: {
      'outbox.id': row.id,
      'outbox.event_type': row.eventType,
      'messaging.destination.name': queue.name,
    },
  });
  const spanContext = trace.setSpan(context.active(), span);
  const metadata = queue.opts.telemetry?.contextManager.getMetadata(spanContext);
  const telemetry = metadata === undefined ? { omitContext: true } : { metadata };
  return { job: { ...job, opts: { ...job.opts, telemetry } }, span };
}

export function tracedDomainEventJobs(rows: UnpublishedOutboxRow[], queue: RelayQueue): TracedJobs {
  const traced = rows.map((row) => tracedJob(row, queue));
  return {
    jobs: traced.map(({ job }) => job),
    spans: traced.flatMap(({ span }) => (span === undefined ? [] : [span])),
  };
}

export async function endedAfter<Result>(spans: Span[], work: Promise<Result>): Promise<Result> {
  try {
    return await work;
  } catch (error) {
    const status = { code: SpanStatusCode.ERROR, message: errorMessageOf(error) };
    spans.forEach((span) => span.setStatus(status));
    throw error;
  } finally {
    spans.forEach((span) => {
      span.end();
    });
  }
}
