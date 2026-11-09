import { isDeepStrictEqual } from 'node:util';

import type { Application, VacancyParseOutput } from '@jobflow/shared';

import { withoutUndefined } from '../../common/without-undefined.js';

const DRAFT_PLACEHOLDERS = {
  position: 'Без назви',
  company: 'компанію не розпізнано',
} as const;

type DraftNames = Pick<Application, 'company' | 'position' | 'source'>;

type DraftSalary = Pick<Application, 'salaryMin' | 'salaryMax' | 'currency'>;

type DraftDetails = Pick<Application, 'stack' | 'location' | 'workMode'>;

export type DraftColumns = DraftNames & DraftSalary & DraftDetails;

export type ParsedColumns = Partial<DraftNames> & DraftSalary & DraftDetails;

export type DraftData = ParsedColumns & { aiParsed: VacancyParseOutput };

export type DraftFields = { data: DraftData; isDraft: boolean };

const SALARY_COLUMN_MAX = 2_147_483_647;

const NO_SALARY: DraftSalary = { salaryMin: null, salaryMax: null, currency: null };

export const DRAFT_BLANK: DraftColumns = {
  ...DRAFT_PLACEHOLDERS,
  ...NO_SALARY,
  source: 'other',
  stack: [],
  location: null,
  workMode: null,
};

type ParsedSalary = { salary: DraftSalary; dropped: boolean };

function salaryOf({ salaryMin, salaryMax, currency }: VacancyParseOutput): ParsedSalary {
  const [min, max] = [salaryMin.value, salaryMax.value];
  const unordered = min !== null && max !== null && min > max;
  const tooLarge = Math.max(min ?? 0, max ?? 0) > SALARY_COLUMN_MAX;
  const dropped = unordered || tooLarge;
  return {
    salary: dropped ? NO_SALARY : { salaryMin: min, salaryMax: max, currency: currency.value },
    dropped,
  };
}

function namedOf({ company, position, sourceGuess }: VacancyParseOutput) {
  return {
    ...(company.value === null ? {} : { company: company.value }),
    ...(position.value === null ? {} : { position: position.value }),
    ...(sourceGuess.value === null ? {} : { source: sourceGuess.value }),
  };
}

export function draftFieldsOf(output: VacancyParseOutput): DraftFields {
  const { company, position, stack, location, workMode } = output;
  const { salary, dropped } = salaryOf(output);
  return {
    data: {
      ...namedOf(output),
      ...salary,
      stack: stack.value,
      location: location.value,
      workMode: workMode.value,
      aiParsed: output,
    },
    isDraft:
      company.value === null ||
      position.value === null ||
      dropped ||
      Object.values(output).some(({ confidence }) => confidence === 'check'),
  };
}

type ColumnGroup = { [Column in keyof DraftColumns]?: DraftColumns[Column] | undefined };

const FILL_GROUPS: ((columns: ColumnGroup) => ColumnGroup)[] = [
  ({ company }) => ({ company }),
  ({ position }) => ({ position }),
  ({ source }) => ({ source }),
  ({ salaryMin, salaryMax, currency }) => ({ salaryMin, salaryMax, currency }),
  ({ stack }) => ({ stack }),
  ({ location }) => ({ location }),
  ({ workMode }) => ({ workMode }),
];

export function untouchedDraftFields(
  current: DraftColumns,
  parsed: ParsedColumns,
): Partial<DraftColumns> {
  const untouched = FILL_GROUPS.filter((group) =>
    isDeepStrictEqual(group(current), group(DRAFT_BLANK)),
  );
  return withoutUndefined(
    untouched.reduce<ColumnGroup>((fields, group) => ({ ...fields, ...group(parsed) }), {}),
  );
}
