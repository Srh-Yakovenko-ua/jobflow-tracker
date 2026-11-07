import { fileURLToPath } from 'node:url';

import { SALARY_TAXES, VACANCY_CURRENCIES } from '@jobflow/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadVacancyCases, type VacancyEvalCase } from './vacancy-cases.js';

const CASES_DIR = fileURLToPath(new URL('../modules/ai/evals/vacancy', import.meta.url));

const EMAIL = /[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+/u;

const PHONE =
  /(?<![\p{L}\p{N}_+])(?:\+\d{1,3}(?:[ .-]?\(?\d{1,4}\)?){2,6}|\(?0\d{2}\)?[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}|\d{3}[ .-]\d{3}[ .-]\d{4})(?!\d)/u;

const scrubbable = (text: string) => EMAIL.test(text) || PHONE.test(text);

describe('the vacancy eval cases', () => {
  let cases: VacancyEvalCase[];

  beforeAll(async () => {
    cases = await loadVacancyCases(CASES_DIR);
  });

  it('holds 15 case files that all parse', () => {
    expect(cases).toHaveLength(15);
  });

  it('holds 6 Ukrainian, 6 English and 3 Russian texts', () => {
    const casesIn = (language: VacancyEvalCase['language']) =>
      cases.filter((evalCase) => evalCase.language === language).length;

    expect({ uk: casesIn('uk'), en: casesIn('en'), ru: casesIn('ru') }).toEqual({
      uk: 6,
      en: 6,
      ru: 3,
    });
  });

  it('expects every normalised currency and both net and gross salaries', () => {
    const expected = cases.map((evalCase) => evalCase.expected);

    expect(new Set(expected.map(({ currency }) => currency))).toEqual(
      new Set([...VACANCY_CURRENCIES, null]),
    );
    expect(new Set(expected.map(({ salaryTax }) => salaryTax))).toEqual(
      new Set([...SALARY_TAXES, null]),
    );
  });

  it('expects no_company_no_position from exactly one case, the pasted requirements block', () => {
    const failing = cases.filter(({ expected }) => expected.failure === 'no_company_no_position');

    expect(failing.map(({ file }) => file)).toEqual(['12-dou-uk-requirements-only.json']);
  });

  it('leaves no email or phone the services/ai scrub would replace', () => {
    expect(cases.filter(({ text }) => scrubbable(text)).map(({ file }) => file)).toEqual([]);
  });

  it.for(['hr@larkwave.example', '+380 67 123 45 67', '(067) 123 45 67', '050 123 4567'])(
    'catches %s with the scrub patterns ported from services/ai',
    (contact) => {
      expect(scrubbable(`Пишіть: ${contact}.`)).toBe(true);
    },
  );
});
