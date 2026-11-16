import type { CaptureRetryResponse, FollowupResponse, JobStatus } from '@jobflow/shared';
import { buildFollowupOutput } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export type FollowupRoutesOptions = Readonly<{
  response?: FollowupResponse | undefined;
  responseOf?: ((applicationId: string) => FollowupResponse | undefined) | undefined;
  generateReply?: HttpResponseResolver<{ id: string }> | undefined;
}>;

export type PostedFollowup = Readonly<{ id: string; idempotencyKey: string | null }>;

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

export const FAILED_AFTER_DRAFT: FollowupResponse = {
  ...READY_FOLLOWUP,
  job: { id: FOLLOWUP_JOB_ID, status: 'failed', errorType: 'ai_timeout' },
};

export function followupJob(
  status: FollowupJob['status'],
  errorType: JobStatus['errorType'] = null,
): FollowupResponse {
  return { ...NO_FOLLOWUP, job: { id: FOLLOWUP_JOB_ID, status, errorType } };
}

export function acceptedFollowup() {
  return HttpResponse.json<CaptureRetryResponse>({ jobId: FOLLOWUP_JOB_ID }, { status: 202 });
}

export function followupRoutes({
  response = NO_FOLLOWUP,
  responseOf = () => undefined,
  generateReply,
}: FollowupRoutesOptions) {
  const state = { response };
  const requested: unknown[] = [];
  const marked: string[] = [];
  const posted: PostedFollowup[] = [];
  const sent = { requested, marked, posted };
  const handlers = [
    http.get<{ id: string }>(apiUrl('/applications/:id/followup'), ({ params }) =>
      HttpResponse.json(responseOf(params.id) ?? state.response),
    ),
    http.post<{ id: string }>(apiUrl('/applications/:id/followup'), async (info) => {
      sent.requested.push(await info.request.json());
      const idempotencyKey = info.request.headers.get('Idempotency-Key');
      sent.posted.push({ id: info.params.id, idempotencyKey });
      return generateReply === undefined ? acceptedFollowup() : generateReply(info);
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
