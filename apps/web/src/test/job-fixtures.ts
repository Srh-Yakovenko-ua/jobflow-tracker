import type { JobStatus } from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export type JobRouteOptions = {
  job: (id: JobStatus['id']) => JobStatus;
  reply?: HttpResponseResolver;
  owner?: JobStatus['applicationId'];
};

export const JOB_ID = buildJobStatus().id;

export const PROCESSING_JOB = buildJobStatus({ status: 'processing', step: 2, queue: null });

export const DONE_JOB = buildJobStatus({ status: 'done', step: 3, queue: null });

export function failedJob(errorType: JobStatus['errorType']): JobStatus {
  return buildJobStatus({ status: 'failed', step: 2, queue: null, errorType });
}

export function jobRoute({ job, reply, owner }: JobRouteOptions) {
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl('/jobs/:id'), (info) => {
    const { id } = info.params;
    sent.push(id);
    const stamped = { ...job(id), id, ...(owner !== undefined && { applicationId: owner }) };
    return reply === undefined ? HttpResponse.json(stamped) : reply(info);
  });
  return { handler, sent };
}
