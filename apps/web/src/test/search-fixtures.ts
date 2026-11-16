import type { FinishSearchResponse, SearchListResponse } from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';

import { ACTIVE_SEARCH, SEARCHES } from './analytics-fixtures';
import { apiUrl } from './api-handlers';
import { ACME_APPLICATION } from './application-fixtures';
import { applicationResponseOf, heldReply, type MoveRouteOptions } from './board-fixtures';

export type FinishSearchRoutesOptions = MoveRouteOptions & { searches?: SearchListResponse };

export const OFFER_APPLICATION = applicationResponseOf({
  ...ACME_APPLICATION,
  currentStage: 'offer',
  searchId: ACTIVE_SEARCH.id,
});

export const FINISHED_SEARCH: FinishSearchResponse = {
  finished: {
    ...ACTIVE_SEARCH,
    status: 'archived',
    outcome: 'offer_accepted',
    finishedAt: '2026-11-12T09:00:00.000Z',
  },
  current: {
    ...ACTIVE_SEARCH,
    id: '0b6f3c1e-5d2a-4c8e-9f10-0000000005a3',
    startedAt: '2026-11-12T09:00:00.000Z',
    days: 0,
    applications: 0,
    interviews: 0,
    offers: 0,
  },
};

export function finishSearchRoutes({
  searches = SEARCHES,
  ...control
}: FinishSearchRoutesOptions = {}) {
  const sent: unknown[] = [];
  const listed: string[] = [];
  const handlers = [
    http.get(apiUrl('/searches'), ({ request }) => {
      listed.push(request.url);
      return HttpResponse.json(searches);
    }),
    http.post(apiUrl('/searches/current/finish'), async (info) => {
      sent.push(await info.request.json());
      return heldReply({ ...control, info, fallback: () => HttpResponse.json(FINISHED_SEARCH) });
    }),
  ];
  return { handlers, sent, listed };
}
