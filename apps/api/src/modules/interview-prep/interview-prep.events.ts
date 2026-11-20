import { interviewPrepVacancySchema } from '@jobflow/shared';
import { z } from 'zod';

import { type AiRequested, aiRequestedEvent } from '../ai/index.js';

export const INTERVIEW_PREP_EVENTS = {
  requested: 'application.interview_prep_requested',
} as const;

export const interviewPrepRequested = aiRequestedEvent(INTERVIEW_PREP_EVENTS.requested, {
  applicationId: z.uuid(),
  input: interviewPrepVacancySchema,
});

export const interviewPrepRequestedPayloadSchema = interviewPrepRequested.schema;

export type InterviewPrepRequestedPayload = z.infer<typeof interviewPrepRequestedPayloadSchema>;

export type InterviewPrepRequested = AiRequested<typeof interviewPrepRequested>;
