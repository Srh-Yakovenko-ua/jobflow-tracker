import { z } from 'zod';

import {
  FOLLOWUP_LIMITS,
  followupInputSchema,
  followupLanguageSchema,
  followupOutputSchema,
  followupToneSchema,
} from '../ai/followup.js';
import { jobStatusSchema } from './job.js';
import { withoutNul } from './text.js';

export const followupRequestFieldsSchema = z.object({
  tone: followupToneSchema,
  language: followupLanguageSchema,
  hint: z.string().trim().max(FOLLOWUP_LIMITS.hintMaxLength).check(withoutNul).optional(),
  variant: z.boolean().default(false),
});

type FollowupRequestFields = z.infer<typeof followupRequestFieldsSchema>;

const withoutEmptyHint = ({ hint, ...request }: FollowupRequestFields) =>
  hint ? { ...request, hint } : request;

export const followupRequestSchema = followupRequestFieldsSchema.transform(withoutEmptyHint);

export const followupResponseSchema = z.object({
  draft: followupOutputSchema.extend({ generatedAt: z.iso.datetime() }).nullable(),
  job: jobStatusSchema.pick({ id: true, status: true, errorType: true }).nullable(),
  language: followupLanguageSchema,
  silenceDays: followupInputSchema.shape.silenceDays,
});

export type FollowupRequestInput = z.input<typeof followupRequestSchema>;
export type FollowupRequest = z.infer<typeof followupRequestSchema>;
export type FollowupResponse = z.infer<typeof followupResponseSchema>;
