import {
  applicationSchema,
  type CvHintsInput,
  matchOutputSchema,
  type ResumeParseOutput,
  resumeParseOutputSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { AI_PAYLOAD_BUILDERS } from '../modules/ai/index.js';
import { scoreMatch } from '../modules/match/index.js';
import { type EvalCase, loadEvalCases, loadEvalFile } from './eval-cases.js';

export const CV_HINTS_EVAL_FILES = { cv: '../match/cv.json' } as const;

export const cvHintsEvalCaseSchema = z.strictObject({
  position: applicationSchema.shape.position,
  requirements: matchOutputSchema.shape.requirements,
  explanation: matchOutputSchema.shape.explanation,
  absent: z.array(z.string().min(1)).min(1),
});

type CvHintsEvalCaseFile = EvalCase<z.infer<typeof cvHintsEvalCaseSchema>>;

export type CvHintsEvalCase = { file: string; input: CvHintsInput; absent: string[] };

function caseOf(evalCase: CvHintsEvalCaseFile, cv: ResumeParseOutput): CvHintsEvalCase {
  const { file, position, requirements, explanation, absent } = evalCase;
  const breakdown = scoreMatch({ requirements, explanation });
  if (breakdown === null) {
    throw new Error(`Eval case ${file} is malformed: it weighs no requirement`);
  }
  return {
    file,
    absent,
    input: AI_PAYLOAD_BUILDERS.cv_hints({ position, profile: cv, breakdown }),
  };
}

export async function loadCvHintsCases(casesDir: string): Promise<CvHintsEvalCase[]> {
  const [cv, cases] = await Promise.all([
    loadEvalFile(casesDir, { file: CV_HINTS_EVAL_FILES.cv, schema: resumeParseOutputSchema }),
    loadEvalCases(casesDir, cvHintsEvalCaseSchema),
  ]);
  return cases.map((evalCase) => caseOf(evalCase, cv));
}
