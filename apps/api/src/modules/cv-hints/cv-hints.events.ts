import { cvHintsInputSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { traceCarrier } from '../../tracing/trace-context.js';

export const CV_HINTS_EVENTS = { requested: 'application.cv_hints_requested' } as const;

export const cvHintsRequestedPayloadSchema = z.object({
  userId: z.uuid(),
  applicationId: z.uuid(),
  resumeVersionId: z.uuid(),
  aiJobId: z.uuid(),
  requestId: z.string().min(1).optional(),
  input: cvHintsInputSchema,
});

export type CvHintsRequestedPayload = z.infer<typeof cvHintsRequestedPayloadSchema>;

export type CvHintsRequested = Omit<CvHintsRequestedPayload, 'userId'>;

export function cvHintsRequestedEvent(
  userId: string,
  requested: CvHintsRequested,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'application',
    aggregateId: requested.applicationId,
    eventType: CV_HINTS_EVENTS.requested,
    payload: { userId, ...requested },
    ...traceCarrier(),
  };
}
