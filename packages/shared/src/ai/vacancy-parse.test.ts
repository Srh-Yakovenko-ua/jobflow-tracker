import { describe, expect, it } from 'vitest';

import { buildVacancyParseOutput, vacancyFieldOf } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  VACANCY_PARSE_LIMITS,
  vacancyParseFailure,
  vacancyParseInputSchema,
  vacancyParseOutputSchema,
} from './vacancy-parse.js';

describe('vacancyParseInputSchema', () => {
  it('keeps the vacancy text limit at 20 000 characters', () => {
    expect(VACANCY_PARSE_LIMITS).toEqual({ textMaxLength: 20_000 });
  });

  it('keeps a vacancy text of exactly 20 000 characters byte for byte', () => {
    const text = `  ${'в'.repeat(19_996)}\n\t`;
    expect(vacancyParseInputSchema.parse({ text })).toEqual({ text });
  });

  it.for([
    { label: 'a missing text', input: {} },
    { label: 'a blank text', input: { text: ' \n\t' } },
    { label: 'a 20 001-character text', input: { text: 'в'.repeat(20_001) } },
    { label: 'a text with a NUL character', input: { text: 'Acme\u0000React' } },
  ])('refuses $label at text', ({ input }) => {
    expect(issuePathsOf(vacancyParseInputSchema.safeParse(input))).toEqual(['text']);
  });
});

const MISSING = vacancyFieldOf(null, null);

const NOTHING_STATED = buildVacancyParseOutput({
  company: MISSING,
  position: MISSING,
  seniority: MISSING,
  salaryMin: MISSING,
  salaryMax: MISSING,
  currency: MISSING,
  workMode: MISSING,
  stack: vacancyFieldOf([], null),
});

const itemsOf = (count: number) => Array.from({ length: count }, () => 'React');

describe('vacancyParseOutputSchema', () => {
  it('accepts a parsed vacancy with a value, a confidence and a quote on every field', () => {
    const parsedVacancy = buildVacancyParseOutput();
    expect(vacancyParseOutputSchema.parse(parsedVacancy)).toEqual(parsedVacancy);
  });

  it('accepts a missing value and a missing quote on every field the vacancy does not state', () => {
    expect(vacancyParseOutputSchema.parse(NOTHING_STATED)).toEqual(NOTHING_STATED);
  });

  it('accepts a quote of exactly 300 characters and a stack of exactly 20 items', () => {
    const stack = vacancyFieldOf(itemsOf(20), 'в'.repeat(300));
    expect(vacancyParseOutputSchema.parse(buildVacancyParseOutput({ stack })).stack).toEqual(stack);
  });

  it.for([
    {
      label: 'a currency outside USD, UAH and EUR',
      patch: { currency: vacancyFieldOf('GBP', 'GBP') },
      path: 'currency.value',
    },
    {
      label: 'a lowercase currency',
      patch: { currency: vacancyFieldOf('usd', 'usd') },
      path: 'currency.value',
    },
    {
      label: 'a quote of 301 characters',
      patch: { company: vacancyFieldOf('Acme', 'в'.repeat(301)) },
      path: 'company.evidence',
    },
    {
      label: 'an empty quote',
      patch: { position: vacancyFieldOf('React developer', '') },
      path: 'position.evidence',
    },
    {
      label: 'a stack of 21 items',
      patch: { stack: vacancyFieldOf(itemsOf(21), 'React') },
      path: 'stack.value',
    },
    {
      label: 'nine requirements',
      patch: { requirements: vacancyFieldOf(itemsOf(9), 'React') },
      path: 'requirements.value',
    },
    {
      label: 'an unknown confidence',
      patch: { salaryTax: { ...MISSING, confidence: 'unsure' } },
      path: 'salaryTax.confidence',
    },
    {
      label: 'a fractional salary',
      patch: { salaryMax: vacancyFieldOf(4500.5, '4500.5') },
      path: 'salaryMax.value',
    },
    {
      label: 'a negative salary',
      patch: { salaryMin: vacancyFieldOf(-1, '-1') },
      path: 'salaryMin.value',
    },
    {
      label: 'an unknown work mode',
      patch: { workMode: vacancyFieldOf('onsite', 'onsite') },
      path: 'workMode.value',
    },
  ])('refuses $label', ({ patch, path }) => {
    const result = vacancyParseOutputSchema.safeParse({ ...buildVacancyParseOutput(), ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('vacancyParseFailure', () => {
  it('names no_company_no_position when neither the company nor the position is found', () => {
    expect(vacancyParseFailure(NOTHING_STATED)).toBe('no_company_no_position');
  });

  it.for([
    { label: 'both are found', patch: {} },
    { label: 'only the company is found', patch: { position: MISSING } },
    { label: 'only the position is found', patch: { company: MISSING } },
  ])('names no failure when $label', ({ patch }) => {
    expect(vacancyParseFailure(buildVacancyParseOutput(patch))).toBeNull();
  });
});
