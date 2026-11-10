import { z } from 'zod';

import { VACANCY_PARSE_LIMITS } from '../ai/vacancy-parse.js';
import { createApplicationInputSchema, possibleDuplicateSchema } from './application.js';
import { plainTextSchema, rawTextSchema } from './text.js';

export const CAPTURE_BOOKMARKLET_LIMITS = {
  bodyMaxBytes: 300 * 1024,
  titleMaxLength: 300,
  textMaxLength: 300_000,
} as const;

export const capturePasteInputSchema = z.object({
  text: rawTextSchema(VACANCY_PARSE_LIMITS.textMaxLength),
  url: createApplicationInputSchema.shape.url,
});

export const captureBookmarkletInputSchema = z.object({
  url: createApplicationInputSchema.shape.url.unwrap().unwrap(),
  title: plainTextSchema(CAPTURE_BOOKMARKLET_LIMITS.titleMaxLength),
  text: rawTextSchema(CAPTURE_BOOKMARKLET_LIMITS.textMaxLength),
  html: rawTextSchema(CAPTURE_BOOKMARKLET_LIMITS.textMaxLength).optional(),
});

export const capturePasteResponseSchema = z.object({
  applicationId: z.uuid(),
  jobId: z.uuid(),
  possibleDuplicates: z.array(possibleDuplicateSchema),
});

export const captureRetryResponseSchema = capturePasteResponseSchema.pick({ jobId: true });

export const DRAFT_PLACEHOLDERS = {
  position: 'Без назви',
  company: 'компанію не розпізнано',
} as const;

export const captureTokenIdSchema = z.uuid();

export const captureTokenCreatedSchema = z.object({
  id: captureTokenIdSchema,
  token: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export const captureTokenSummarySchema = captureTokenCreatedSchema
  .omit({ token: true })
  .extend({ lastUsedAt: z.iso.datetime().nullable() });

export const captureTokenListResponseSchema = z.object({
  items: z.array(captureTokenSummarySchema),
});

export type CapturePasteInput = z.infer<typeof capturePasteInputSchema>;
export type CaptureBookmarkletInput = z.infer<typeof captureBookmarkletInputSchema>;
export type CapturePasteResponse = z.infer<typeof capturePasteResponseSchema>;
export type CaptureRetryResponse = z.infer<typeof captureRetryResponseSchema>;
export type CaptureTokenCreated = z.infer<typeof captureTokenCreatedSchema>;
export type CaptureTokenSummary = z.infer<typeof captureTokenSummarySchema>;
export type CaptureTokenListResponse = z.infer<typeof captureTokenListResponseSchema>;
