import { z } from 'zod';

import { scheduledEventKindSchema } from '../scheduled-events.js';
import { applicationSchema } from '../schemas/application.js';
import { registerInputSchema } from '../schemas/auth.js';
import { plainTextSchema, rawTextSchema } from '../schemas/text.js';
import { stageSchema } from '../stages.js';

export const FOLLOWUP_TONES = ['neutral', 'warm', 'short'] as const;
export const FOLLOWUP_LANGUAGES = ['uk', 'en'] as const;

export const FOLLOWUP_LIMITS = {
  hintMaxLength: 300,
  recruiterNameMaxLength: 60,
  subjectMaxLength: 120,
  bodyMaxLength: 1200,
  wordsMin: 60,
  wordsMax: 120,
  variantTemperature: 0.9,
} as const;

export const followupToneSchema = z.enum(FOLLOWUP_TONES);
export const followupLanguageSchema = z.enum(FOLLOWUP_LANGUAGES);

export const followupInputSchema = z.object({
  recruiterFirstName: plainTextSchema(FOLLOWUP_LIMITS.recruiterNameMaxLength).nullable(),
  company: applicationSchema.shape.company,
  position: applicationSchema.shape.position,
  stage: stageSchema,
  silenceDays: z.int().nonnegative(),
  lastInterview: z.object({ kind: scheduledEventKindSchema, date: z.iso.date() }).nullable(),
  senderName: registerInputSchema.shape.displayName.unwrap().nullable(),
  language: followupLanguageSchema,
  tone: followupToneSchema,
  hint: rawTextSchema(FOLLOWUP_LIMITS.hintMaxLength).nullable(),
});

export const followupOutputSchema = z.object({
  subject: z.string().min(1).max(FOLLOWUP_LIMITS.subjectMaxLength),
  body: z.string().min(1).max(FOLLOWUP_LIMITS.bodyMaxLength),
});

export type FollowupTone = z.infer<typeof followupToneSchema>;
export type FollowupLanguage = z.infer<typeof followupLanguageSchema>;
export type FollowupInput = z.infer<typeof followupInputSchema>;
export type FollowupOutput = z.infer<typeof followupOutputSchema>;
