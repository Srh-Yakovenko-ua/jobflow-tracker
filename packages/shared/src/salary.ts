import type { VacancyCurrency } from './ai/vacancy-parse.js';
import type { RejectionReasonCode } from './rejection-reasons.js';

export const SALARY_NORMALISATION = {
  perUsd: { USD: 1, EUR: 0.86, UAH: 41.5 } satisfies Record<VacancyCurrency, number>,
  netShareOfGross: 0.77,
  reasonCodes: ['salary_expectations', 'low_salary'] satisfies readonly RejectionReasonCode[],
} as const;
