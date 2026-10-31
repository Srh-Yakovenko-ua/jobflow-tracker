import { describe, expect, it } from 'vitest';

import { buildVacancyParseOutput } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  VACANCY_PARSE_LIMITS,
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

describe('vacancyParseOutputSchema', () => {
  it('accepts a parsed vacancy', () => {
    const parsedVacancy = buildVacancyParseOutput();
    expect(vacancyParseOutputSchema.parse(parsedVacancy)).toEqual(parsedVacancy);
  });

  it('accepts null for every field the vacancy does not state', () => {
    const unstated = {
      company: null,
      position: null,
      location: null,
      workMode: null,
      salaryMin: null,
      salaryMax: null,
      currency: null,
      stack: [],
    };
    expect(vacancyParseOutputSchema.parse(unstated)).toEqual(unstated);
  });

  it('accepts a stack of exactly 20 items', () => {
    const stack = Array.from({ length: 20 }, () => 'TypeScript');
    expect(vacancyParseOutputSchema.parse(buildVacancyParseOutput({ stack })).stack).toHaveLength(
      20,
    );
  });

  it.for([
    { label: 'a stack of 21 items', patch: { stack: Array.from({ length: 21 }, () => 'React') } },
    { label: 'a lowercase currency', patch: { currency: 'usd' } },
    { label: 'a negative salary', patch: { salaryMin: -1 } },
    { label: 'a fractional salary', patch: { salaryMax: 4500.5 } },
    { label: 'an unknown work mode', patch: { workMode: 'onsite' } },
  ])('refuses $label', ({ patch }) => {
    const [field] = Object.keys(patch);
    const result = vacancyParseOutputSchema.safeParse({ ...buildVacancyParseOutput(), ...patch });
    expect(issuePathsOf(result)).toEqual([field]);
  });
});
