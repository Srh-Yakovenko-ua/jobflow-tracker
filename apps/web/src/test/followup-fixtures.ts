import type { CaptureRetryResponse, FollowupResponse, JobStatus } from '@jobflow/shared';
import { buildFollowupOutput } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export type FollowupRoutesOptions = Readonly<{
  response?: FollowupResponse | undefined;
  generateReply?: HttpResponseResolver | undefined;
}>;

type FollowupJob = NonNullable<FollowupResponse['job']>;

export const FOLLOWUP_JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1c01';

export const DESIGN_FOLLOWUP = buildFollowupOutput();

export const NO_FOLLOWUP: FollowupResponse = {
  draft: null,
  job: null,
  language: 'uk',
  silenceDays: 4,
};

export const READY_FOLLOWUP: FollowupResponse = {
  ...NO_FOLLOWUP,
  draft: { ...DESIGN_FOLLOWUP, generatedAt: '2026-11-12T09:00:00.000Z' },
  job: { id: FOLLOWUP_JOB_ID, status: 'done', errorType: null },
};

export function followupJob(
  status: FollowupJob['status'],
  errorType: JobStatus['errorType'] = null,
): FollowupResponse {
  return { ...NO_FOLLOWUP, job: { id: FOLLOWUP_JOB_ID, status, errorType } };
}

export function followupRoutes({ response = NO_FOLLOWUP, generateReply }: FollowupRoutesOptions) {
  const state = { response };
  const requested: unknown[] = [];
  const marked: string[] = [];
  const sent = { requested, marked };
  const accepted = () =>
    HttpResponse.json<CaptureRetryResponse>({ jobId: FOLLOWUP_JOB_ID }, { status: 202 });
  const handlers = [
    http.get(apiUrl('/applications/:id/followup'), () => HttpResponse.json(state.response)),
    http.post(apiUrl('/applications/:id/followup'), async (info) => {
      sent.requested.push(await info.request.json());
      return generateReply === undefined ? accepted() : generateReply(info);
    }),
    http.post<{ id: string }>(apiUrl('/applications/:id/followup/sent'), ({ params }) => {
      sent.marked.push(params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
  return {
    handlers,
    sent,
    answer: (next: FollowupResponse) => {
      state.response = next;
    },
  };
}
