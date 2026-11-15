import type { InterviewPrepResponse, JobStatus } from '@jobflow/shared';
import { INTERVIEW_PREP_OUTPUT } from '@jobflow/shared/testing';

import { aiResultJobOf, aiResultRoutes } from './ai-result-routes';

type InterviewPrepJobStatus = NonNullable<InterviewPrepResponse['job']>['status'];

export const INTERVIEW_PREP_JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1e01';

export const NO_INTERVIEW_PREP: InterviewPrepResponse = { result: null, job: null };

export const READY_INTERVIEW_PREP: InterviewPrepResponse = {
  result: { ...INTERVIEW_PREP_OUTPUT, generatedAt: '2026-11-15T09:00:00.000Z' },
  job: { id: INTERVIEW_PREP_JOB_ID, status: 'done', errorType: null },
};

export function interviewPrepJob(
  status: InterviewPrepJobStatus,
  errorType: JobStatus['errorType'] = null,
): InterviewPrepResponse {
  return aiResultJobOf({ id: INTERVIEW_PREP_JOB_ID, status, errorType });
}

export function interviewPrepRoutes(initial: InterviewPrepResponse = NO_INTERVIEW_PREP) {
  return aiResultRoutes({
    path: '/applications/:id/interview-prep',
    jobId: INTERVIEW_PREP_JOB_ID,
    initial,
  });
}
