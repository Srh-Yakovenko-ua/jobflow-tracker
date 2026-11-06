import type { ApplicationListItem, ApplicationListResponse } from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';
import { type CardRun, cardsIn, heldReply, type MoveRouteOptions } from './board-fixtures';

export type PagedListRouteOptions = Pick<MoveRouteOptions, 'latch'> & {
  items: readonly ApplicationListItem[];
  pageSize?: number;
};

type PageSlice = Readonly<{ items: readonly ApplicationListItem[]; from: number; to: number }>;

export function listItemsIn(run: CardRun): ApplicationListItem[] {
  return cardsIn(run).map((card) => ({ ...card, snippet: null }));
}

function pageOf({ items, from, to }: PageSlice): ApplicationListResponse {
  return {
    items: items.slice(from, to),
    nextCursor: to < items.length ? String(to) : null,
  };
}

export function pagedListRoute({ items, pageSize = 100, ...control }: PagedListRouteOptions) {
  const sent: string[] = [];
  const handler = http.get(apiUrl('/applications'), (info) => {
    const { searchParams } = new URL(info.request.url);
    sent.push(searchParams.toString());
    const from = Number(searchParams.get('cursor') ?? 0);
    const page = pageOf({ items, from, to: from + pageSize });
    return heldReply({ ...control, info, fallback: () => HttpResponse.json(page) });
  });
  return { handler, sent };
}
