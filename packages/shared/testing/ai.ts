import type { AiCompletion } from '../src/ai/completion.js';
import { AI_PROMPT_VERSIONS } from '../src/ai/kinds.js';
import type { MatchOutput } from '../src/ai/match.js';
import type { ResumeParseOutput } from '../src/ai/resume-parse.js';
import type { VacancyConfidence, VacancyParseOutput } from '../src/ai/vacancy-parse.js';

type VacancyCompletion = AiCompletion<'vacancy_parse'>;
type MatchCompletion = AiCompletion<'match'>;

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

export function buildResumeParseOutput(
  overrides: Partial<ResumeParseOutput> = {},
): ResumeParseOutput {
  return {
    positions: [
      { title: 'Frontend developer', company: 'Acme', start: '2021-03', end: null },
      { title: 'Junior developer', company: null, start: '2019-09', end: '2021-02' },
    ],
    skills: [
      { name: 'React', years: 0, evidence: 'Built the Acme dashboard in React', positions: [0, 1] },
      { name: 'TypeScript', years: 0, evidence: null, positions: [0] },
    ],
    totalYears: 0,
    seniority: 'middle',
    englishLevel: 'upper_intermediate',
    domains: ['fintech'],
    leadership: { hasExperience: false, evidence: null },
    languages: [{ name: 'English', level: 'B2' }],
    ...overrides,
  };
}

export function buildMatchOutput(overrides: Partial<MatchOutput> = {}): MatchOutput {
  return {
    requirements: [
      { name: 'React + TypeScript', weight: 'must', coverage: 'full' },
      { name: 'Node.js у проді', weight: 'must', coverage: 'full' },
      { name: 'GraphQL', weight: 'nice', coverage: 'partial' },
      { name: 'AWS / інфраструктура', weight: 'must', coverage: 'missing' },
      { name: 'Досвід ліда команди 3+', weight: 'nice', coverage: 'missing' },
      { name: 'Домен fintech', weight: 'mentioned', coverage: 'missing' },
    ],
    explanation: 'Стек збігається, бракує AWS і досвіду ліда.',
    ...overrides,
  };
}

const FAKE_CALL = { model: 'fake', tokensIn: 120, tokensOut: 40, latencyMs: 15 };

export function buildVacancyCompletion(
  overrides: Partial<VacancyCompletion> = {},
): VacancyCompletion {
  return {
    output: buildVacancyParseOutput(),
    promptVersion: AI_PROMPT_VERSIONS.vacancy_parse,
    ...FAKE_CALL,
    ...overrides,
  };
}

export function buildMatchCompletion(overrides: Partial<MatchCompletion> = {}): MatchCompletion {
  return {
    output: buildMatchOutput(),
    promptVersion: AI_PROMPT_VERSIONS.match,
    ...FAKE_CALL,
    ...overrides,
  };
}
