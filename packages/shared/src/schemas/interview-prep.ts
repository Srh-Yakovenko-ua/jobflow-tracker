import { z } from 'zod';

import { interviewPrepOutputSchema } from '../ai/interview-prep.js';
import { aiResultJobSchema, generatedAtShape } from './job.js';

export const interviewPrepResponseSchema = z.object({
  result: interviewPrepOutputSchema.extend(generatedAtShape).nullable(),
  job: aiResultJobSchema,
});

export type InterviewPrepResponse = z.infer<typeof interviewPrepResponseSchema>;
