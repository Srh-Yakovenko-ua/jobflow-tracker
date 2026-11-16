'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useId } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Fade } from '@/shared/ui/fade';

import { type ComparedOffer, rankOffers, type ScoredOffer } from '../lib/offer-score';
import type { ComparisonMode } from '../model/comparison-mode';
import type { OfferNotes } from '../model/comparison-store';
import { type ComparisonStore, useComparisonStore } from '../model/use-comparison-store';
import { useKeptFocus } from '../model/use-kept-focus';
import { ComparisonSkeleton } from './comparison-skeleton';
import { OfferColumn } from './offer-column';
import { WeightPanel, WeightSummary } from './weight-panel';

const COPY = uk.offerCompare;

const GRID_COLUMNS = {
  two: '@xl:grid-cols-2',
  three: '@xl:grid-cols-2 @4xl:grid-cols-3',
  four: '@xl:grid-cols-2 @min-[70rem]:grid-cols-4',
} as const;

function gridColumnsOf(count: number): string {
  if (count === 2) return GRID_COLUMNS.two;
  return count === 3 ? GRID_COLUMNS.three : GRID_COLUMNS.four;
}

function notesBindingOf(store: ComparisonStore, offerId: ApplicationResponse['id']) {
  return {
    value: store.notesOf(offerId),
    onChange: (patch: Partial<OfferNotes>) => {
      const notes = { ...store.notesOf(offerId), ...patch };
      store.store({ ...store.value, offers: { ...store.value.offers, [offerId]: notes } });
    },
  };
}

type RankedColumnsProps = Readonly<{
  ranked: readonly ScoredOffer[];
  store: ComparisonStore;
  readOnly: boolean;
}>;

function RankedColumns({ ranked, store, readOnly }: RankedColumnsProps) {
  const titleId = useId();
  const leader = ranked[0]?.offer.company ?? '';
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
      <h2 id={titleId} className="eyebrow text-ink-3">
        {COPY.ranking}
      </h2>
      <p role="status" className="sr-only">
        {COPY.leader(leader)}
      </p>
      <div className={cn('grid min-w-0 grid-cols-1 gap-4', gridColumnsOf(ranked.length))}>
        <AnimatePresence mode="popLayout" initial={false}>
          {ranked.map((scored, index) => (
            <Fade key={scored.offer.id} motion={{ layout: 'position' }} className="min-w-0">
              <OfferColumn
                ranked={{ ...scored, rank: index + 1 }}
                notes={notesBindingOf(store, scored.offer.id)}
                view={{ readOnly }}
              />
            </Fade>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

export type OfferRankingProps = Readonly<{
  offers: readonly ComparedOffer[];
  mode: ComparisonMode;
}>;

export function OfferRanking({ offers, mode }: OfferRankingProps) {
  const store = useComparisonStore(offers.map((offer) => offer.id));
  const ranked = rankOffers({ offers, comparison: store.value });
  const { containerRef, onFocus, onBlur } = useKeptFocus(
    ranked.map(({ offer }) => offer.id).join(),
  );
  if (!store.ready) return <ComparisonSkeleton />;
  const readOnly = mode === 'print';
  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-col gap-6"
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {readOnly ? (
        <WeightSummary comparison={store.value} />
      ) : (
        <WeightPanel comparison={store.value} onChange={store.store} />
      )}
      <RankedColumns ranked={ranked} store={store} readOnly={readOnly} />
    </div>
  );
}
