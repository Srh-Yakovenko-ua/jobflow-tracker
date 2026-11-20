'use client';

import { type ApplicationListQuery, PAGINATION_LIMITS } from '@jobflow/shared';
import { useQueries, useQuery } from '@tanstack/react-query';

import { applicationListQueryOptions, applicationQueryOptions } from '@/entities/application';
import { type RetryLoad, sectionLoadOf } from '@/shared/lib/section-load';

import type { ComparedOffer } from '../lib/offer-score';

export type OffersView =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; load: RetryLoad }>
  | Readonly<{ kind: 'ready'; offers: readonly ComparedOffer[] }>;

const ACTIVE_OFFERS: ApplicationListQuery = {
  stage: ['offer'],
  limit: PAGINATION_LIMITS.maxLimit,
  sort: '-lastEventAt',
};

export function useOffers(): OffersView {
  const list = useQuery({
    ...applicationListQueryOptions(ACTIVE_OFFERS),
    select: (page) =>
      page.items.filter((item) => !item.isDraft).map(({ id, aiStatus }) => ({ id, aiStatus })),
  });
  const listed = list.data ?? [];
  const reads = useQueries({ queries: listed.map(({ id }) => applicationQueryOptions(id)) });
  const load = sectionLoadOf(...[list, ...reads].filter((query) => query.errorUpdateCount > 0));
  if (load.failed || load.stale) return { kind: 'error', load };
  const offers = reads.flatMap((read, index) => {
    const aiStatus = listed[index]?.aiStatus ?? null;
    return read.data === undefined ? [] : [{ ...read.data, aiStatus }];
  });
  if (list.data === undefined || offers.length < listed.length) return { kind: 'loading' };
  return { kind: 'ready', offers };
}
