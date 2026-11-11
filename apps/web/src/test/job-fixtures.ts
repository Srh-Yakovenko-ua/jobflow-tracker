import { type ApplicationResponse, type JobStatus, jobStatusSchema } from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export type JobRouteOptions = {
  job: (id: JobStatus['id']) => JobStatus;
  reply?: HttpResponseResolver;
  owner?: ApplicationResponse['id'] | null;
};

type JobStamp = Readonly<{ id: JobStatus['id']; owner: JobRouteOptions['owner'] }>;

const OK = 200;

export const JOB_ID = buildJobStatus().id;

export const PROCESSING_JOB = buildJobStatus({ status: 'processing', step: 2, queue: null });

export const DONE_JOB = buildJobStatus({ status: 'done', step: 3, queue: null });

export function failedJob(errorType: JobStatus['errorType']): JobStatus {
  return buildJobStatus({ status: 'failed', step: 2, queue: null, errorType });
}

function stampedJob(job: JobStatus, { id, owner }: JobStamp): Response {
  return HttpResponse.json({ ...job, id, ...(owner !== undefined && { applicationId: owner }) });
}

export function jobRoute({ job, reply, owner }: JobRouteOptions) {
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl('/jobs/:id'), async (info) => {
    const { id } = info.params;
    sent.push(id);
    if (reply === undefined) return stampedJob(job(id), { id, owner });
    const replied = await reply(info);
    if (!(replied instanceof Response) || replied.status !== OK) return replied;
    const body: unknown = await replied.json();
    return stampedJob(jobStatusSchema.parse(body), { id, owner });
  });
  return { handler, sent };
}
