import {
  sourceSchema,
  vacancyParseFailureSchema,
  vacancyParseInputSchema,
  vacancyValueSchemas,
} from '@jobflow/shared';
import { z } from 'zod';

import { type EvalCase, loadEvalCases } from './eval-cases.js';

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

export type VacancyEvalCase = EvalCase<VacancyEvalCaseFile>;

export function loadVacancyCases(casesDir: string): Promise<VacancyEvalCase[]> {
  return loadEvalCases(casesDir, vacancyEvalCaseSchema);
}
