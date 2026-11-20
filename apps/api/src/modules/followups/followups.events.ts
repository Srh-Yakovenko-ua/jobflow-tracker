import { followupInputSchema } from '@jobflow/shared';
import { z } from 'zod';

import { aiRequestedEvent } from '../ai/index.js';

export const FOLLOWUP_EVENTS = { requested: 'application.followup_requested' } as const;

export const followupRequested = aiRequestedEvent(FOLLOWUP_EVENTS.requested, {
  applicationId: z.uuid(),
  input: followupInputSchema,
  fresh: z.literal(true).optional(),
});

export const followupRequestedPayloadSchema = followupRequested.schema;

export type FollowupRequestedPayload = z.infer<typeof followupRequestedPayloadSchema>;
