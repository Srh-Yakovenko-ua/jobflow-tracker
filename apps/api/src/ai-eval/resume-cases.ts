import { readdir } from 'node:fs/promises';

import { englishLevelSchema, senioritySchema } from '@jobflow/shared';
import { z } from 'zod';

import { loadEvalCases } from './eval-cases.js';

export const resumeExpectedSchema = z.strictObject({
  skills: z.array(z.string().min(1)).min(1),
  seniority: senioritySchema.nullable(),
  englishLevel: englishLevelSchema.nullable(),
});

export type ResumeExpected = z.infer<typeof resumeExpectedSchema>;

export type ResumeEvalCase = { file: string; document: string; expected: ResumeExpected };

const EXPECTED_SUFFIX = '.expected.json';

function documentOf(entries: string[], file: string): string {
  const stem = file.endsWith(EXPECTED_SUFFIX) ? file.slice(0, -EXPECTED_SUFFIX.length) : null;
  const document = entries.find((entry) => entry !== file && entry.startsWith(`${stem ?? file}.`));
  if (stem === null || document === undefined) {
    throw new Error(`Eval case ${file} has no document beside it`);
  }
  return document;
}

export async function loadResumeCases(casesDir: string): Promise<ResumeEvalCase[]> {
  const entries = await readdir(casesDir);
  const cases = await loadEvalCases(casesDir, resumeExpectedSchema);
  return cases.map(({ file, ...expected }) => ({
    file,
    document: documentOf(entries, file),
    expected,
  }));
}
