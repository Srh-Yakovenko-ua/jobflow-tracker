import { z } from 'zod';

import { cvHintsOutputSchema } from '../ai/cv-hints.js';
import { aiResultJobSchema, generatedAtShape } from './job.js';

export const cvHintsResponseSchema = z.object({
  result: cvHintsOutputSchema.extend(generatedAtShape).nullable(),
  job: aiResultJobSchema,
});

export type CvHintsResponse = z.infer<typeof cvHintsResponseSchema>;
