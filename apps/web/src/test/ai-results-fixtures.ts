import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

const NO_CONTENT: HttpResponseResolver = () => new HttpResponse(null, { status: 204 });

export function deleteAiResultsRoute(reply: HttpResponseResolver = NO_CONTENT) {
  const sent: string[] = [];
  const handler = http.delete(apiUrl('/ai-results'), (info) => {
    sent.push(info.request.method);
    return reply(info);
  });
  return { handler, sent };
}
