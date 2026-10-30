import { applicationListQuerySchema } from '@jobflow/shared';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { analyticsKeys } from '@/entities/analytics';
import { applicationKeys, timelineKeys } from '@/entities/application';
import { notificationKeys } from '@/entities/notification';
import { resumeKeys } from '@/entities/resume';

import { invalidateAfterMove } from './invalidate-after-move';

const APPLICATION_ID = '01920000-0000-7000-8000-000000000001';

function clientWithOneQueryPerKey() {
  const queryClient = new QueryClient();
  const queryKeys = [
    applicationKeys.board({}),
    applicationKeys.board({ q: 'react' }),
    applicationKeys.list(applicationListQuerySchema.parse({})),
    applicationKeys.detail(APPLICATION_ID),
    applicationKeys.reasonsSummary('tech_interview'),
    timelineKeys.detail(APPLICATION_ID),
    resumeKeys.list(),
    analyticsKeys.summary(),
    notificationKeys.list(),
  ];
  queryKeys.forEach((queryKey) => queryClient.setQueryData(queryKey, {}));
  return queryClient;
}

function invalidatedKeysOf(queryClient: QueryClient) {
  return queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.state.isInvalidated)
    .map((query) => query.queryKey);
}

describe('invalidateAfterMove', () => {
  it('invalidates every board, every application detail, the reasons summaries and the analytics summary and nothing else', async () => {
    const queryClient = clientWithOneQueryPerKey();

    await invalidateAfterMove(queryClient);

    expect(invalidatedKeysOf(queryClient)).toEqual([
      ['applications', 'board', {}],
      ['applications', 'board', { q: 'react' }],
      ['applications', 'detail', APPLICATION_ID],
      ['applications', 'reasons-summary', 'tech_interview'],
      ['analytics', 'summary'],
    ]);
  });
});
