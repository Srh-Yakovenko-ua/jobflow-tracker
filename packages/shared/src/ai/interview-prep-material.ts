import { type ApplicationMatchResponse, byPointsLostThenName } from '../schemas/match.js';
import { INTERVIEW_PREP_LIMITS, type InterviewPrepGap } from './interview-prep.js';
import { vacancyParseOutputSchema } from './vacancy-parse.js';

export type InterviewPrepVacancySource = Readonly<{ aiParsed: unknown; stack: readonly string[] }>;

export function interviewPrepRequirementsOf({
  aiParsed,
  stack,
}: InterviewPrepVacancySource): string[] {
  const parsed = vacancyParseOutputSchema.safeParse(aiParsed).data?.requirements.value ?? [];
  const items = [...parsed, ...stack].map((item) => item.trim()).filter((item) => item !== '');
  return [...new Set(items)].slice(0, INTERVIEW_PREP_LIMITS.requirementsMax);
}

export function interviewPrepGapsOf(match: ApplicationMatchResponse['match']): InterviewPrepGap[] {
  if (match === null) {
    return [];
  }
  const missing = match.missing.map((row) => ({ ...row, coverage: 'missing' as const }));
  const partial = match.matched.flatMap(({ coverage, ...row }) =>
    coverage === 'partial' ? [{ ...row, coverage }] : [],
  );
  return [...missing, ...partial]
    .sort(byPointsLostThenName)
    .map(({ name, coverage }) => ({ name, coverage }));
}
