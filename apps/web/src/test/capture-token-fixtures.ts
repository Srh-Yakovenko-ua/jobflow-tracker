import type {
  CaptureTokenCreated,
  CaptureTokenListResponse,
  CaptureTokenSummary,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, errorReply } from './api-handlers';

const CAPTURE_TOKENS_URL = apiUrl('/capture/tokens');

export const USED_TOKEN: CaptureTokenSummary = {
  id: '0b6f3c1e-5d2a-4c8e-9f10-0000000000c1',
  createdAt: '2026-11-08T22:30:00.000Z',
  lastUsedAt: '2026-11-09T23:15:00.000Z',
};

export const UNUSED_TOKEN: CaptureTokenSummary = {
  id: '0b6f3c1e-5d2a-4c8e-9f10-0000000000c2',
  createdAt: '2026-11-07T10:00:00.000Z',
  lastUsedAt: null,
};

export const MINTED_TOKENS = [
  {
    id: '0b6f3c1e-5d2a-4c8e-9f10-0000000000d1',
    token: 'capture-token-one',
    createdAt: '2026-11-10T08:00:00.000Z',
  },
  {
    id: '0b6f3c1e-5d2a-4c8e-9f10-0000000000d2',
    token: 'capture-token-two',
    createdAt: '2026-11-10T08:05:00.000Z',
  },
] as const satisfies readonly CaptureTokenCreated[];

export type CaptureTokenReplies = Partial<
  Record<'list' | 'create' | 'revoke', HttpResponseResolver>
>;

export type CaptureTokenRoutesOptions = {
  items?: readonly CaptureTokenSummary[];
  replies?: CaptureTokenReplies;
};

export function captureTokenRoutes({ items = [], replies = {} }: CaptureTokenRoutesOptions = {}) {
  const store = { items: [...items] };
  const sent: string[] = [];
  const mint = () => {
    const created = MINTED_TOKENS[sent.filter((request) => request === 'POST').length - 1];
    if (created === undefined) return errorReply({ status: 500, type: 'internal_error' });
    store.items = [{ id: created.id, createdAt: created.createdAt, lastUsedAt: null }];
    return HttpResponse.json<CaptureTokenCreated>(created, { status: 201 });
  };
  const remove = (id: string) => {
    if (!store.items.some((item) => item.id === id)) {
      return errorReply({ status: 404, type: 'not_found' });
    }
    store.items = store.items.filter((item) => item.id !== id);
    return new HttpResponse(null, { status: 204 });
  };
  const handlers = [
    http.get(
      CAPTURE_TOKENS_URL,
      replies.list ?? (() => HttpResponse.json<CaptureTokenListResponse>({ items: store.items })),
    ),
    http.post(CAPTURE_TOKENS_URL, (info) => {
      sent.push('POST');
      return replies.create?.(info) ?? mint();
    }),
    http.delete<{ id: string }>(`${CAPTURE_TOKENS_URL}/:id`, (info) => {
      sent.push(`DELETE ${info.params.id}`);
      return replies.revoke?.(info) ?? remove(info.params.id);
    }),
  ];
  return { handlers, sent, store };
}
