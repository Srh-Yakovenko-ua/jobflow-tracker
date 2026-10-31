import type { AiCompletion } from '../src/ai/completion.js';
import type { VacancyParseOutput } from '../src/ai/vacancy-parse.js';

type VacancyCompletion = AiCompletion<'vacancy_parse'>;

export function buildVacancyParseOutput(
  overrides: Partial<VacancyParseOutput> = {},
): VacancyParseOutput {
  return {
    company: 'Acme',
    position: 'Senior React developer',
    location: null,
    workMode: 'remote',
    salaryMin: 4000,
    salaryMax: 5000,
    currency: 'USD',
    stack: ['React'],
    ...overrides,
  };
}

export function buildVacancyCompletion(
  overrides: Partial<VacancyCompletion> = {},
): VacancyCompletion {
  return {
    output: buildVacancyParseOutput(),
    model: 'fake',
    promptVersion: 'v1',
    tokensIn: 120,
    tokensOut: 40,
    latencyMs: 15,
    ...overrides,
  };
}
