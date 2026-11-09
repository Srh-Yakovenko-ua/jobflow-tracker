import type { Application, VacancyParseOutput } from '@jobflow/shared';

export const DRAFT_PLACEHOLDERS = {
  position: 'Без назви',
  company: 'компанію не розпізнано',
} as const;

type DraftSalary = Pick<Application, 'salaryMin' | 'salaryMax' | 'currency'>;

export type DraftData = Partial<Pick<Application, 'company' | 'position' | 'source'>> &
  DraftSalary &
  Pick<Application, 'stack' | 'location' | 'workMode'> & { aiParsed: VacancyParseOutput };

export type DraftFields = { data: DraftData; isDraft: boolean };

const SALARY_COLUMN_MAX = 2_147_483_647;

const NO_SALARY: DraftSalary = { salaryMin: null, salaryMax: null, currency: null };

function salaryOf({ salaryMin, salaryMax, currency }: VacancyParseOutput): DraftSalary {
  const [min, max] = [salaryMin.value, salaryMax.value];
  const unordered = min !== null && max !== null && min > max;
  const tooLarge = Math.max(min ?? 0, max ?? 0) > SALARY_COLUMN_MAX;
  return unordered || tooLarge
    ? NO_SALARY
    : { salaryMin: min, salaryMax: max, currency: currency.value };
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
  return {
    data: {
      ...namedOf(output),
      ...salaryOf(output),
      stack: stack.value,
      location: location.value,
      workMode: workMode.value,
      aiParsed: output,
    },
    isDraft:
      company.value === null ||
      position.value === null ||
      Object.values(output).some(({ confidence }) => confidence === 'check'),
  };
}
