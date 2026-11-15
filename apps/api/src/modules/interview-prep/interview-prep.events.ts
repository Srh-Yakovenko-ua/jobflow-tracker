import { interviewPrepVacancySchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { traceCarrier } from '../../tracing/trace-context.js';

export const INTERVIEW_PREP_EVENTS = {
  requested: 'application.interview_prep_requested',
} as const;

export const interviewPrepRequestedPayloadSchema = z.object({
  userId: z.uuid(),
  applicationId: z.uuid(),
  aiJobId: z.uuid(),
  requestId: z.string().min(1).optional(),
  input: interviewPrepVacancySchema,
});

export type InterviewPrepRequestedPayload = z.infer<typeof interviewPrepRequestedPayloadSchema>;

export type InterviewPrepRequested = Omit<InterviewPrepRequestedPayload, 'userId'>;

export function interviewPrepRequestedEvent(
  userId: string,
  requested: InterviewPrepRequested,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'application',
    aggregateId: requested.applicationId,
    eventType: INTERVIEW_PREP_EVENTS.requested,
    payload: { userId, ...requested },
    ...traceCarrier(),
  };
}
