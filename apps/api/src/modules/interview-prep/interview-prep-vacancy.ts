import {
  type ApplicationMatchResponse,
  byPointsLostThenName,
  INTERVIEW_PREP_LIMITS,
  type InterviewPrepGap,
  type InterviewPrepVacancy,
  interviewPrepVacancySchema,
  vacancyParseOutputSchema,
} from '@jobflow/shared';

import { type AppError, conflict } from '../../common/app-error.js';
import { toValidationError } from '../../common/validation.js';
import type { InterviewPrepSourceRow } from './interview-prep.repository.js';

export type InterviewPrepParts = {
  row: InterviewPrepSourceRow;
  match: ApplicationMatchResponse['match'];
};

export type PreparedVacancy = { vacancy: InterviewPrepVacancy } | { refusal: AppError };

export const INTERVIEW_PREP_REFUSALS = {
  noInterview: 'Interview prep needs a planned interview',
  nothingToPrepare: 'Interview prep needs vacancy requirements or Match Score gaps',
} as const;

function requirementsOf({ aiParsed, stack }: InterviewPrepSourceRow): string[] {
  const parsed = vacancyParseOutputSchema.safeParse(aiParsed).data?.requirements.value ?? [];
  const items = [...parsed, ...stack].map((item) => item.trim()).filter((item) => item !== '');
  return [...new Set(items)].slice(0, INTERVIEW_PREP_LIMITS.requirementsMax);
}

function gapsOf(match: InterviewPrepParts['match']): InterviewPrepGap[] {
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

export function preparedVacancyOf({ row, match }: InterviewPrepParts): PreparedVacancy {
  const [interview] = row.scheduledEvents;
  if (interview === undefined) {
    return { refusal: conflict(INTERVIEW_PREP_REFUSALS.noInterview) };
  }
  const requirements = requirementsOf(row);
  const gaps = gapsOf(match);
  if (requirements.length === 0 && gaps.length === 0) {
    return { refusal: conflict(INTERVIEW_PREP_REFUSALS.nothingToPrepare) };
  }
  const parsed = interviewPrepVacancySchema.safeParse({
    position: row.position,
    interviewKind: interview.kind,
    requirements,
    gaps,
  });
  return parsed.success
    ? { vacancy: parsed.data }
    : { refusal: toValidationError(parsed.error.issues) };
}
