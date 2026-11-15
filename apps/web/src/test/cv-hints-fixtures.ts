import type { CvHintsResponse, JobStatus } from '@jobflow/shared';
import { CV_HINTS_OUTPUT } from '@jobflow/shared/testing';

import { aiResultJobOf, aiResultRoutes } from './ai-result-routes';

type CvHintsJobStatus = NonNullable<CvHintsResponse['job']>['status'];

export const CV_HINTS_JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1d01';

export const NO_CV_HINTS: CvHintsResponse = { result: null, job: null };

export const READY_CV_HINTS: CvHintsResponse = {
  result: { ...CV_HINTS_OUTPUT, generatedAt: '2026-11-15T09:00:00.000Z' },
  job: { id: CV_HINTS_JOB_ID, status: 'done', errorType: null },
};

export const EMPTY_CV_HINTS: CvHintsResponse = {
  ...READY_CV_HINTS,
  result: { hints: [], gaps: [], generatedAt: '2026-11-15T09:00:00.000Z' },
};

export function cvHintsJob(
  status: CvHintsJobStatus,
  errorType: JobStatus['errorType'] = null,
): CvHintsResponse {
  return aiResultJobOf({ id: CV_HINTS_JOB_ID, status, errorType });
}

export function cvHintsRoutes(initial: CvHintsResponse = NO_CV_HINTS) {
  return aiResultRoutes({ path: '/applications/:id/cv-hints', jobId: CV_HINTS_JOB_ID, initial });
}
