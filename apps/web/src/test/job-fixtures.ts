import type { JobStatus } from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export type JobRouteOptions = { job: () => JobStatus; reply?: HttpResponseResolver };

export function jobRoute({ job, reply }: JobRouteOptions) {
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl('/jobs/:id'), (info) => {
    sent.push(info.params.id);
    return reply === undefined ? HttpResponse.json({ ...job(), id: info.params.id }) : reply(info);
  });
  return { handler, sent };
}
