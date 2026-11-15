import {
  type ApplicationMatchResponse,
  interviewPrepGapsOf,
  interviewPrepRequirementsOf,
  type InterviewPrepVacancy,
  interviewPrepVacancySchema,
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

export function preparedVacancyOf({ row, match }: InterviewPrepParts): PreparedVacancy {
  const [interview] = row.scheduledEvents;
  if (interview === undefined) {
    return { refusal: conflict(INTERVIEW_PREP_REFUSALS.noInterview) };
  }
  const requirements = interviewPrepRequirementsOf(row);
  const gaps = interviewPrepGapsOf(match);
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
