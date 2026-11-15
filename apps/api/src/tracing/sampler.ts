import { SpanKind } from '@opentelemetry/api';
import { ParentBasedSampler, type Sampler, SamplingDecision } from '@opentelemetry/sdk-trace';

import { QUEUES } from '../queues/queues.js';

const TRACE_STARTING_KINDS: ReadonlySet<SpanKind> = new Set([SpanKind.SERVER, SpanKind.CONSUMER]);

const UNTRACED_ROOTS: ReadonlySet<string> = new Set([`process ${QUEUES.maintenance.name}`]);

const userActionRoots: Sampler = {
  shouldSample: (...[, , name, kind]: Parameters<Sampler['shouldSample']>) => ({
    decision:
      TRACE_STARTING_KINDS.has(kind) && !UNTRACED_ROOTS.has(name)
        ? SamplingDecision.RECORD_AND_SAMPLED
        : SamplingDecision.NOT_RECORD,
  }),
  toString: () => 'UserActionRootSampler',
};

export const traceSampler = new ParentBasedSampler({ root: userActionRoots });
