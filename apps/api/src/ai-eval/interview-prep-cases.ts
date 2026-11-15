import { type InterviewPrepInput, interviewPrepInputSchema } from '@jobflow/shared';
import { z } from 'zod';

import { loadEvalCases } from './eval-cases.js';

export const interviewPrepEvalCaseSchema = z.strictObject({
  ...interviewPrepInputSchema.shape,
  absent: z.array(z.string().min(1)).min(1),
});

export type InterviewPrepEvalCase = { file: string; input: InterviewPrepInput; absent: string[] };

export async function loadInterviewPrepCases(casesDir: string): Promise<InterviewPrepEvalCase[]> {
  const cases = await loadEvalCases(casesDir, interviewPrepEvalCaseSchema);
  return cases.map(({ file, absent, ...input }) => ({ file, absent, input }));
}
