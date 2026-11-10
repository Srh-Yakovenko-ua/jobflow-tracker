import type { JobStatus } from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export type JobRouteOptions = {
  job: (id: JobStatus['id']) => JobStatus;
  reply?: HttpResponseResolver;
};

export function failedJob(errorType: JobStatus['errorType']): JobStatus {
  return buildJobStatus({ status: 'failed', step: 2, queue: null, errorType });
}

export function jobRoute({ job, reply }: JobRouteOptions) {
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl('/jobs/:id'), (info) => {
    const { id } = info.params;
    sent.push(id);
    return reply === undefined ? HttpResponse.json({ ...job(id), id }) : reply(info);
  });
  return { handler, sent };
}
