import type { AiCompletion } from '../src/ai/completion.js';
import { AI_PROMPT_VERSIONS } from '../src/ai/kinds.js';
import type { VacancyConfidence, VacancyParseOutput } from '../src/ai/vacancy-parse.js';

type VacancyCompletion = AiCompletion<'vacancy_parse'>;

export const VACANCY_SAMPLE_TEXT = 'Senior React developer, Acme, remote, 4000-5000 USD';

export function vacancyFieldOf<Value>(value: Value, evidence: string | null) {
  const confidence: VacancyConfidence = evidence === null ? 'missing' : 'exact';
  return { value, confidence, evidence };
}

export function buildVacancyParseOutput(
  overrides: Partial<VacancyParseOutput> = {},
): VacancyParseOutput {
  return {
    company: vacancyFieldOf('Acme', 'Acme'),
    position: vacancyFieldOf('Senior React developer', 'Senior React developer'),
    seniority: vacancyFieldOf('senior', 'Senior'),
    salaryMin: vacancyFieldOf(4000, '4000-5000 USD'),
    salaryMax: vacancyFieldOf(5000, '4000-5000 USD'),
    currency: vacancyFieldOf('USD', 'USD'),
    salaryTax: vacancyFieldOf(null, null),
    location: vacancyFieldOf(null, null),
    workMode: vacancyFieldOf('remote', 'remote'),
    stack: vacancyFieldOf(['React'], 'React'),
    requirements: vacancyFieldOf([], null),
    englishLevel: vacancyFieldOf(null, null),
    sourceGuess: vacancyFieldOf(null, null),
    ...overrides,
  };
}

export function buildVacancyCompletion(
  overrides: Partial<VacancyCompletion> = {},
): VacancyCompletion {
  return {
    output: buildVacancyParseOutput(),
    model: 'fake',
    promptVersion: AI_PROMPT_VERSIONS.vacancy_parse,
    tokensIn: 120,
    tokensOut: 40,
    latencyMs: 15,
    ...overrides,
  };
}
