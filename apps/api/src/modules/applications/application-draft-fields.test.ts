import type { VacancyParseOutput } from '@jobflow/shared';
import { buildVacancyParseOutput, vacancyFieldOf } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { PARSED_VACANCY_COLUMNS } from '../../test/ai.js';
import { BLANK_DRAFT_COLUMNS } from '../../test/capture.js';
import {
  type DraftColumns,
  draftFieldsOf,
  type ParsedColumns,
  untouchedDraftFields,
} from './application-draft-fields.js';

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
    isDraft: true,
  },
  {
    parse: 'with a salary the column cannot hold',
    overrides: { salaryMax: vacancyFieldOf(2_147_483_648, '2147483648') },
    fields: { ...PARSED, ...NO_SALARY },
    isDraft: true,
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

const PARSED_WITH_SOURCE: ParsedColumns = { ...PARSED, source: 'djinni' };

const SALARY_GROUP = ['salaryMin', 'salaryMax', 'currency'];

type EditCase = { edited: string; edit: Partial<DraftColumns>; kept: string[] };

const EDITS: EditCase[] = [
  { edited: 'nothing', edit: {}, kept: [] },
  { edited: 'the company', edit: { company: 'Ромашка' }, kept: ['company'] },
  { edited: 'the position', edit: { position: 'Lead React developer' }, kept: ['position'] },
  { edited: 'the source', edit: { source: 'dou' }, kept: ['source'] },
  { edited: 'the salary range', edit: { salaryMin: 3000, salaryMax: 3500 }, kept: SALARY_GROUP },
  { edited: 'the currency', edit: { currency: 'EUR' }, kept: SALARY_GROUP },
  { edited: 'the stack', edit: { stack: ['Vue'] }, kept: ['stack'] },
  { edited: 'the location', edit: { location: 'Київ' }, kept: ['location'] },
  { edited: 'the work mode', edit: { workMode: 'office' }, kept: ['workMode'] },
];

describe('untouchedDraftFields', () => {
  it.each(EDITS)('fills every parsed field but the group of $edited', ({ edit, kept }) => {
    const filled = Object.entries(PARSED_WITH_SOURCE).filter(([field]) => !kept.includes(field));

    expect(untouchedDraftFields({ ...BLANK_DRAFT_COLUMNS, ...edit }, PARSED_WITH_SOURCE)).toEqual(
      Object.fromEntries(filled),
    );
  });

  it('names no source when the parse guesses none', () => {
    expect(Object.keys(untouchedDraftFields(BLANK_DRAFT_COLUMNS, PARSED))).toEqual(
      Object.keys(PARSED),
    );
  });
});
