import { z } from 'zod';

import { applicationFieldsSchema, STACK_MAX_ITEMS } from '../schemas/application.js';
import { rawTextSchema, withoutNul } from '../schemas/text.js';
import { sourceSchema } from '../sources.js';

export const VACANCY_PARSE_LIMITS = {
  textMaxLength: 20_000,
  evidenceMaxLength: 300,
  requirementMaxLength: 200,
  requirementsMax: 8,
  stackMax: STACK_MAX_ITEMS,
} as const;

export const VACANCY_CONFIDENCES = ['exact', 'check', 'missing'] as const;
export const VACANCY_CURRENCIES = ['USD', 'UAH', 'EUR'] as const;
export const SENIORITIES = ['intern', 'junior', 'middle', 'senior', 'lead'] as const;
export const ENGLISH_LEVELS = [
  'beginner',
  'pre_intermediate',
  'intermediate',
  'upper_intermediate',
  'advanced',
] as const;
export const SALARY_TAXES = ['net', 'gross'] as const;
export const VACANCY_PARSE_FAILURES = ['no_company_no_position'] as const;

export const vacancyConfidenceSchema = z.enum(VACANCY_CONFIDENCES);
export const vacancyCurrencySchema = z.enum(VACANCY_CURRENCIES);
export const senioritySchema = z.enum(SENIORITIES);
export const englishLevelSchema = z.enum(ENGLISH_LEVELS);
export const salaryTaxSchema = z.enum(SALARY_TAXES);
export const vacancyParseFailureSchema = z.enum(VACANCY_PARSE_FAILURES);

export const vacancyParseInputSchema = z.object({
  text: rawTextSchema(VACANCY_PARSE_LIMITS.textMaxLength),
});

const quotedTextSchema = (maxLength: number) => z.string().min(1).max(maxLength).check(withoutNul);

const applicationFields = applicationFieldsSchema.shape;

export const vacancyValueSchemas = {
  company: applicationFields.company.nullable(),
  position: applicationFields.position.nullable(),
  seniority: senioritySchema.nullable(),
  salaryMin: applicationFields.salaryMin,
  salaryMax: applicationFields.salaryMax,
  currency: vacancyCurrencySchema.nullable(),
  salaryTax: salaryTaxSchema.nullable(),
  location: applicationFields.location,
  workMode: applicationFields.workMode,
  stack: applicationFields.stack,
  requirements: z
    .array(quotedTextSchema(VACANCY_PARSE_LIMITS.requirementMaxLength))
    .max(VACANCY_PARSE_LIMITS.requirementsMax),
  englishLevel: englishLevelSchema.nullable(),
  sourceGuess: sourceSchema.nullable(),
};

const vacancyField = <Value extends z.ZodType>(value: Value) =>
  z.object({
    value,
    confidence: vacancyConfidenceSchema,
    evidence: quotedTextSchema(VACANCY_PARSE_LIMITS.evidenceMaxLength).nullable(),
  });

export const vacancyParseOutputSchema = z.object({
  company: vacancyField(vacancyValueSchemas.company),
  position: vacancyField(vacancyValueSchemas.position),
  seniority: vacancyField(vacancyValueSchemas.seniority),
  salaryMin: vacancyField(vacancyValueSchemas.salaryMin),
  salaryMax: vacancyField(vacancyValueSchemas.salaryMax),
  currency: vacancyField(vacancyValueSchemas.currency),
  salaryTax: vacancyField(vacancyValueSchemas.salaryTax),
  location: vacancyField(vacancyValueSchemas.location),
  workMode: vacancyField(vacancyValueSchemas.workMode),
  stack: vacancyField(vacancyValueSchemas.stack),
  requirements: vacancyField(vacancyValueSchemas.requirements),
  englishLevel: vacancyField(vacancyValueSchemas.englishLevel),
  sourceGuess: vacancyField(vacancyValueSchemas.sourceGuess),
});

export type VacancyParseInput = z.infer<typeof vacancyParseInputSchema>;
export type VacancyParseOutput = z.infer<typeof vacancyParseOutputSchema>;
export type VacancyConfidence = z.infer<typeof vacancyConfidenceSchema>;
export type VacancyCurrency = z.infer<typeof vacancyCurrencySchema>;
export type Seniority = z.infer<typeof senioritySchema>;
export type EnglishLevel = z.infer<typeof englishLevelSchema>;
export type SalaryTax = z.infer<typeof salaryTaxSchema>;
export type VacancyParseFailure = z.infer<typeof vacancyParseFailureSchema>;

export const vacancyParseFailure = ({
  company,
  position,
}: VacancyParseOutput): VacancyParseFailure | null =>
  company.value === null && position.value === null ? 'no_company_no_position' : null;
