import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  sourceSchema,
  vacancyParseFailureSchema,
  vacancyParseInputSchema,
  vacancyValueSchemas,
} from '@jobflow/shared';
import { z } from 'zod';

const spellingsSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).nullable();

const { shape: scoredValueSchemas } = z.object(vacancyValueSchemas).omit({ requirements: true });

export const vacancyExpectedSchema = z.strictObject({
  ...scoredValueSchemas,
  company: spellingsSchema,
  position: spellingsSchema,
  location: spellingsSchema,
  failure: vacancyParseFailureSchema.nullable(),
});

export const vacancyEvalCaseSchema = z.strictObject({
  source: sourceSchema.extract(['djinni', 'dou']),
  language: z.enum(['uk', 'ru', 'en']),
  text: vacancyParseInputSchema.shape.text,
  expected: vacancyExpectedSchema,
});

export type VacancyExpected = z.infer<typeof vacancyExpectedSchema>;

export type VacancyEvalCaseFile = z.infer<typeof vacancyEvalCaseSchema>;

export type VacancyEvalCase = VacancyEvalCaseFile & { file: string };

const CASE_FILE = /\.json$/;

function describeRefusal(error: unknown): string {
  return error instanceof z.ZodError ? z.prettifyError(error) : String(error);
}

function parseCase(file: string, content: string): VacancyEvalCase {
  try {
    return { file, ...vacancyEvalCaseSchema.parse(JSON.parse(content)) };
  } catch (error) {
    throw new Error(`Eval case ${file} is malformed: ${describeRefusal(error)}`, { cause: error });
  }
}

export async function loadVacancyCases(casesDir: string): Promise<VacancyEvalCase[]> {
  const files = (await readdir(casesDir)).filter((file) => CASE_FILE.test(file)).sort();
  if (files.length === 0) {
    throw new Error(`No eval cases in ${casesDir}`);
  }
  return Promise.all(
    files.map(async (file) => parseCase(file, await readFile(join(casesDir, file), 'utf8'))),
  );
}
