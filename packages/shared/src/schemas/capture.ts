import { z } from 'zod';

import { VACANCY_PARSE_LIMITS } from '../ai/vacancy-parse.js';
import { createApplicationInputSchema, possibleDuplicateSchema } from './application.js';
import { rawTextSchema } from './text.js';

export const capturePasteInputSchema = z.object({
  text: rawTextSchema(VACANCY_PARSE_LIMITS.textMaxLength),
  url: createApplicationInputSchema.shape.url,
});

export const capturePasteResponseSchema = z.object({
  applicationId: z.uuid(),
  jobId: z.uuid(),
  possibleDuplicates: z.array(possibleDuplicateSchema),
});

export type CapturePasteInput = z.infer<typeof capturePasteInputSchema>;
export type CapturePasteResponse = z.infer<typeof capturePasteResponseSchema>;
