import type { ExportAccepted, ExportLink, ReadyExportLink } from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, idempotencyKeyOf } from './api-handlers';
import { EXPORT_ID } from './notification-fixtures';

export type SentBody = Readonly<{ body: unknown; idempotencyKey: string | null }>;

export const EXPORT_LINK: ReadyExportLink = {
  status: 'ready',
  url: 'https://storage.test/users/u1/exports/archive.zip?signature=abc',
  expiresAt: '2026-11-14T11:00:00.000Z',
};

const NO_EXPORT_YET = () => HttpResponse.json<ExportLink>({ status: 'pending' });

const NO_CONTENT: HttpResponseResolver = () => new HttpResponse(null, { status: 204 });

export type ExportRoutesOptions = Readonly<{
  readyAfterLinks?: number;
  link?: HttpResponseResolver;
}>;

export function exportRoutes({ readyAfterLinks = 1, link }: ExportRoutesOptions = {}) {
  const sent = { requests: [] as SentBody[], links: [] as string[] };
  const handlers = [
    http.post(apiUrl('/me/export'), async ({ request }) => {
      const body: unknown = await request.json();
      sent.requests.push({ body, idempotencyKey: idempotencyKeyOf(request.headers) });
      return HttpResponse.json<ExportAccepted>({ exportId: EXPORT_ID }, { status: 202 });
    }),
    http.get(apiUrl('/me/exports/:exportId'), (info) => {
      sent.links.push(String(info.params['exportId']));
      if (link !== undefined) return link(info);
      return sent.links.length > readyAfterLinks ? HttpResponse.json(EXPORT_LINK) : NO_EXPORT_YET();
    }),
  ];
  return { handlers, sent };
}

export function importRoute(reply: HttpResponseResolver) {
  const sent: SentBody[] = [];
  const handler = http.post(apiUrl('/applications/import'), async (info) => {
    const body: unknown = await info.request.json();
    sent.push({ body, idempotencyKey: idempotencyKeyOf(info.request.headers) });
    return reply(info);
  });
  return { handler, sent };
}

export function deleteAccountRoute(reply: HttpResponseResolver = NO_CONTENT) {
  const sent: unknown[] = [];
  const handler = http.delete(apiUrl('/me'), async (info) => {
    sent.push(await info.request.json());
    return reply(info);
  });
  return { handler, sent };
}
