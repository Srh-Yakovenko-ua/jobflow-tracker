import { cvHintsInputSchema } from '@jobflow/shared';
import { z } from 'zod';

import { type AiRequested, aiRequestedEvent } from '../ai/index.js';

export const CV_HINTS_EVENTS = { requested: 'application.cv_hints_requested' } as const;

export const cvHintsRequested = aiRequestedEvent(CV_HINTS_EVENTS.requested, {
  applicationId: z.uuid(),
  resumeVersionId: z.uuid(),
  input: cvHintsInputSchema,
});

export const cvHintsRequestedPayloadSchema = cvHintsRequested.schema;

export type CvHintsRequestedPayload = z.infer<typeof cvHintsRequestedPayloadSchema>;

export type CvHintsRequested = AiRequested<typeof cvHintsRequested>;
