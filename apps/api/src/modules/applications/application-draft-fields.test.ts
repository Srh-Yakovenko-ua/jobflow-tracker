import type { VacancyParseOutput } from '@jobflow/shared';
import { buildVacancyParseOutput, vacancyFieldOf } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { PARSED_VACANCY_COLUMNS } from '../../test/ai.js';
import { draftFieldsOf } from './application-draft-fields.js';

const PARSED = PARSED_VACANCY_COLUMNS;

const { company, position, ...details } = PARSED;

const NO_SALARY = { salaryMin: null, salaryMax: null, currency: null };

type DraftCase = {
  parse: string;
  overrides: Partial<VacancyParseOutput>;
  fields: object;
  isDraft: boolean;
};

const CASES: DraftCase[] = [
  { parse: 'with every field exact', overrides: {}, fields: PARSED, isDraft: false },
  {
    parse: 'without a company',
    overrides: { company: vacancyFieldOf(null, null) },
    fields: { position, ...details },
    isDraft: true,
  },
  {
    parse: 'without a position',
    overrides: { position: vacancyFieldOf(null, null) },
    fields: { company, ...details },
    isDraft: true,
  },
  {
    parse: 'with a salary range in the wrong order',
    overrides: { salaryMin: vacancyFieldOf(6000, '6000'), salaryMax: vacancyFieldOf(5000, '5000') },
    fields: { ...PARSED, ...NO_SALARY },
    isDraft: false,
  },
  {
    parse: 'with a salary the column cannot hold',
    overrides: { salaryMax: vacancyFieldOf(2_147_483_648, '2147483648') },
    fields: { ...PARSED, ...NO_SALARY },
    isDraft: false,
  },
  {
    parse: 'with the largest salary the column holds',
    overrides: { salaryMax: vacancyFieldOf(2_147_483_647, '2147483647') },
    fields: { ...PARSED, salaryMax: 2_147_483_647 },
    isDraft: false,
  },
  {
    parse: 'with a guessed source',
    overrides: { sourceGuess: vacancyFieldOf('djinni', 'djinni.co') },
    fields: { ...PARSED, source: 'djinni' },
    isDraft: false,
  },
  {
    parse: 'with a location and a work mode',
    overrides: {
      location: vacancyFieldOf('Київ', 'Київ'),
      workMode: vacancyFieldOf('hybrid', 'hybrid'),
    },
    fields: { ...PARSED, location: 'Київ', workMode: 'hybrid' },
    isDraft: false,
  },
  {
    parse: 'with one field to check',
    overrides: { location: { value: 'Львів', confidence: 'check', evidence: 'Lviv or remote' } },
    fields: { ...PARSED, location: 'Львів' },
    isDraft: true,
  },
];

describe('draftFieldsOf', () => {
  it.each(CASES)('maps a parse $parse', ({ overrides, fields, isDraft }) => {
    const output = buildVacancyParseOutput(overrides);

    expect(draftFieldsOf(output)).toEqual({ data: { ...fields, aiParsed: output }, isDraft });
  });
});
