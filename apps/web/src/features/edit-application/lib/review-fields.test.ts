import type { VacancyParseOutput } from '@jobflow/shared';
import { buildVacancyParseOutput, vacancyFieldOf } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { checkFieldOf as checked, REVIEW_DRAFT, SALARY_IN_TEXT } from '@/test/application-fixtures';

import { reviewFieldsOf } from './review-fields';

const MISSING = { confidence: 'missing', quote: null };

function salaryOf(patch: Partial<VacancyParseOutput>) {
  const aiParsed = buildVacancyParseOutput({
    salaryMin: vacancyFieldOf(null, null),
    salaryMax: vacancyFieldOf(null, null),
    currency: vacancyFieldOf(null, null),
    ...patch,
  });
  return reviewFieldsOf({ ...REVIEW_DRAFT, aiParsed })?.salary;
}

describe('reviewFieldsOf', () => {
  it('reads each form field with its confidence and its quote from the vacancy text', () => {
    expect(reviewFieldsOf(REVIEW_DRAFT)).toEqual({
      company: { confidence: 'exact', quote: 'Acme' },
      position: { confidence: 'exact', quote: 'Senior React developer' },
      salary: { confidence: 'check', quote: SALARY_IN_TEXT },
      source: MISSING,
      stack: { confidence: 'exact', quote: 'React' },
    });
  });

  it('the source reads the guess the parse made', () => {
    const aiParsed = buildVacancyParseOutput({ sourceGuess: checked('djinni', 'Mode: remote') });

    expect(reviewFieldsOf({ ...REVIEW_DRAFT, aiParsed })?.source).toEqual({
      confidence: 'check',
      quote: 'Mode: remote',
    });
  });

  it('one salary part to check makes the whole salary перевір, with the quote of that part', () => {
    const salary = salaryOf({
      salaryMin: vacancyFieldOf(4700, 'Salary'),
      currency: checked('USD', 'net'),
    });

    expect(salary).toEqual({ confidence: 'check', quote: 'net' });
  });

  it('an exact salary part beside missing ones makes the salary точно, with its quote', () => {
    expect(salaryOf({ salaryMax: vacancyFieldOf(5900, '5900') })).toEqual({
      confidence: 'exact',
      quote: '5900',
    });
  });

  it('a salary nobody stated stays missing', () => {
    expect(salaryOf({})).toEqual(MISSING);
  });

  it('a quote the vacancy text does not hold comes back as no quote, the confidence kept', () => {
    const aiParsed = buildVacancyParseOutput({ company: checked('Acme', 'Acme Corp LLC') });

    expect(reviewFieldsOf({ ...REVIEW_DRAFT, aiParsed })?.company).toEqual({
      confidence: 'check',
      quote: null,
    });
  });

  it.each([
    { name: 'no parse', aiParsed: null },
    { name: 'a parse of another shape', aiParsed: { company: 'Acme' } },
    {
      name: 'a parse with an unknown confidence',
      aiParsed: {
        ...buildVacancyParseOutput(),
        stack: { value: [], confidence: 'sure', evidence: null },
      },
    },
  ])('$name gives no review', ({ aiParsed }) => {
    expect(reviewFieldsOf({ ...REVIEW_DRAFT, aiParsed })).toBeNull();
  });
});
