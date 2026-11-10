import { AI_JOB_FAILURES, type JobStatus, VACANCY_PARSE_FAILURES } from '@jobflow/shared';

import type { uk } from '@/shared/i18n';

export type FailureReason = keyof typeof uk.add.failed.reasons;

const [NO_FIELDS] = VACANCY_PARSE_FAILURES;

const REASON_BY_ERROR_TYPE: ReadonlyMap<string, FailureReason> = new Map([
  [NO_FIELDS, 'noFields'],
  [AI_JOB_FAILURES.timeout, 'timeout'],
  [AI_JOB_FAILURES.budgetExceeded, 'budget'],
  [AI_JOB_FAILURES.notReady, 'providerDown'],
  [AI_JOB_FAILURES.providerError, 'providerDown'],
  [AI_JOB_FAILURES.rateLimited, 'providerDown'],
]);

export function failureReasonOf(errorType: JobStatus['errorType']): FailureReason {
  return REASON_BY_ERROR_TYPE.get(errorType ?? '') ?? 'generic';
}
