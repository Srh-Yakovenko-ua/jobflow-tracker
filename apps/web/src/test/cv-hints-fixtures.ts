import type { CaptureRetryResponse, CvHintsResponse, JobStatus } from '@jobflow/shared';
import { CV_HINTS_OUTPUT } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

type CvHintsJobStatus = NonNullable<CvHintsResponse['job']>['status'];

type CvHintsRouteState = { response: CvHintsResponse; reply: HttpResponseResolver | null };

const CV_HINTS_PATH = '/applications/:id/cv-hints';

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
  return { result: null, job: { id: CV_HINTS_JOB_ID, status, errorType } };
}

export function cvHintsRoutes(initial: CvHintsResponse = NO_CV_HINTS) {
  const state: CvHintsRouteState = { response: initial, reply: null };
  const requested: string[] = [];
  const handlers = [
    http.get(apiUrl(CV_HINTS_PATH), () => HttpResponse.json(state.response)),
    http.post<{ id: string }>(apiUrl(CV_HINTS_PATH), (info) => {
      requested.push(info.params.id);
      if (state.reply !== null) return state.reply(info);
      return HttpResponse.json<CaptureRetryResponse>({ jobId: CV_HINTS_JOB_ID }, { status: 202 });
    }),
  ];
  return {
    handlers,
    requested,
    answer: (next: CvHintsResponse) => {
      state.response = next;
    },
    refuse: (reply: HttpResponseResolver) => {
      state.reply = reply;
    },
  };
}
