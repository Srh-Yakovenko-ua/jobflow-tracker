'use client';

import {
  type ApplicationListQuery,
  type ApplicationResponse,
  PAGINATION_LIMITS,
} from '@jobflow/shared';
import { useQueries, useQuery } from '@tanstack/react-query';

import { applicationListQueryOptions, applicationQueryOptions } from '@/entities/application';

export type OffersView =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; refetch: () => void }>
  | Readonly<{ kind: 'ready'; offers: readonly ApplicationResponse[] }>;

const ACTIVE_OFFERS: ApplicationListQuery = {
  stage: ['offer'],
  limit: PAGINATION_LIMITS.maxLimit,
  sort: '-lastEventAt',
};

export function useOffers(): OffersView {
  const list = useQuery({
    ...applicationListQueryOptions(ACTIVE_OFFERS),
    select: (page) => page.items.filter((item) => !item.isDraft).map((item) => item.id),
  });
  const ids = list.data ?? [];
  const reads = useQueries({ queries: ids.map((id) => applicationQueryOptions(id)) });
  const failed = [list, ...reads].filter((query) => query.isError);
  if (failed.length > 0) {
    return {
      kind: 'error',
      refetch: () => {
        for (const query of failed) void query.refetch();
      },
    };
  }
  const offers = reads.flatMap((read) => (read.data === undefined ? [] : [read.data]));
  if (list.data === undefined || offers.length < ids.length) return { kind: 'loading' };
  return { kind: 'ready', offers };
}
