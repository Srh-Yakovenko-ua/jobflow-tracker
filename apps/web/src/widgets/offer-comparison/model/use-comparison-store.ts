'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { useUserStorageKey } from '@/entities/user';
import { useStoredJson } from '@/shared/lib/use-stored-json';

import {
  type Comparison,
  comparisonSchema,
  DEFAULT_COMPARISON,
  EMPTY_OFFER_NOTES,
  type OfferNotes,
} from './comparison-store';

type OfferId = ApplicationResponse['id'];

export type ComparisonStore = Readonly<{
  ready: boolean;
  value: Comparison;
  notesOf: (offerId: OfferId) => OfferNotes;
  store: (next: Comparison) => void;
}>;

export function useComparisonStore(offerIds: readonly OfferId[]): ComparisonStore {
  const key = useUserStorageKey('offer-compare');
  const stored = useStoredJson({ key, schema: comparisonSchema, fallback: DEFAULT_COMPARISON });
  return {
    ready: key !== undefined,
    value: stored.value,
    notesOf: (offerId) => stored.value.offers[offerId] ?? EMPTY_OFFER_NOTES,
    store: (next) => {
      const kept = offerIds.flatMap((offerId) => {
        const notes = next.offers[offerId];
        return notes === undefined ? [] : [[offerId, notes] as const];
      });
      const pruned = { ...next, offers: Object.fromEntries(kept) };
      stored.store(() => pruned);
    },
  };
}
