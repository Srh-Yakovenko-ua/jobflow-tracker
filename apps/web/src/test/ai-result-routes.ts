import type { AiJobAccepted, JobStatus } from '@jobflow/shared';
import type { HttpResponseResolver, JsonBodyType } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export type AiResultRoutesSetup<Response extends JsonBodyType> = Readonly<{
  path: string;
  jobId: string;
  initial: Response;
}>;

export type AiResultJobSeed = Readonly<{
  id: string;
  status: JobStatus['status'];
  errorType?: JobStatus['errorType'];
}>;

export function aiResultJobOf({ id, status, errorType = null }: AiResultJobSeed) {
  return { result: null, job: { id, status, errorType } };
}

export function aiResultRoutes<Response extends JsonBodyType>({
  path,
  jobId,
  initial,
}: AiResultRoutesSetup<Response>) {
  const state: { response: Response; reply: HttpResponseResolver | null } = {
    response: initial,
    reply: null,
  };
  const requested: string[] = [];
  const handlers = [
    http.get(apiUrl(path), () => HttpResponse.json(state.response)),
    http.post<{ id: string }>(apiUrl(path), (info) => {
      requested.push(info.params.id);
      if (state.reply !== null) return state.reply(info);
      return HttpResponse.json<AiJobAccepted>({ jobId }, { status: 202 });
    }),
  ];
  return {
    handlers,
    requested,
    answer: (next: Response) => {
      state.response = next;
    },
    refuse: (reply: HttpResponseResolver) => {
      state.reply = reply;
    },
  };
}
