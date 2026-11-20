import { yearMonthSchema } from '@jobflow/shared';
import { z } from 'zod';

import { type AiRequested, aiRequestedEvent } from '../ai/index.js';

export const SUMMARY_EVENTS = { requested: 'summary.requested' } as const;

export const summaryRequested = aiRequestedEvent(SUMMARY_EVENTS.requested, {
  searchId: z.uuid(),
  month: yearMonthSchema,
  fresh: z.literal(true).optional(),
});

export const summaryRequestedPayloadSchema = summaryRequested.schema;

export type SummaryRequestedPayload = z.infer<typeof summaryRequestedPayloadSchema>;

export type SummaryRequested = AiRequested<typeof summaryRequested>;
