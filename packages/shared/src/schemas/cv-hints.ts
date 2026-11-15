import { z } from 'zod';

import { cvHintsOutputSchema } from '../ai/cv-hints.js';
import { jobStatusSchema } from './job.js';

export const cvHintsResponseSchema = z.object({
  result: cvHintsOutputSchema.extend({ generatedAt: z.iso.datetime() }).nullable(),
  job: jobStatusSchema.pick({ id: true, status: true, errorType: true }).nullable(),
});

export type CvHintsResponse = z.infer<typeof cvHintsResponseSchema>;
