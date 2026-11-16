'use client';

import Link from 'next/link';

import { OFFER_COMPARE } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { buttonLinkClasses } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { PAGE_TITLE } from '@/shared/ui/page-title';
import { PrintSheet } from '@/shared/ui/print-sheet';

import type { ComparisonMode } from '../model/comparison-mode';
import { useOffers } from '../model/use-offers';
import { ComparisonSkeleton } from './comparison-skeleton';
import { ComparisonToolbar } from './comparison-toolbar';
import { OfferRanking } from './offer-ranking';

export type { ComparisonMode } from '../model/comparison-mode';

const COPY = uk.offerCompare;

const EMPTY = COPY.empty;

function MissingOffers({ count }: Readonly<{ count: number }>) {
  const { minOffers } = OFFER_COMPARE;
  return (
    <EmptyState
      content={{ eyebrow: EMPTY.eyebrow, title: EMPTY.title(minOffers - count), hint: EMPTY.hint }}
      progress={{ count, goal: minOffers, label: EMPTY.meter }}
      slots={{
        action: (
          <Link href="/board" className={buttonLinkClasses({ variant: 'primary', size: 'md' })}>
            {EMPTY.toBoard}
          </Link>
        ),
      }}
      view={{ tone: 'offer' }}
    />
  );
}

function ComparisonBody({ mode }: Readonly<{ mode: ComparisonMode }>) {
  const offers = useOffers();
  if (offers.kind === 'error') return <LoadFailedPanel onRetry={offers.refetch} />;
  if (offers.kind === 'loading') return <ComparisonSkeleton />;
  if (offers.offers.length < OFFER_COMPARE.minOffers) {
    return <MissingOffers count={offers.offers.length} />;
  }
  return <OfferRanking offers={offers.offers} mode={mode} />;
}

function ComparisonHeading() {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h1 className={PAGE_TITLE}>{COPY.title}</h1>
      <p className="max-w-[60ch] text-[15px] leading-[1.55] text-ink-2">{COPY.lead}</p>
    </div>
  );
}

export type OfferComparisonProps = Readonly<{ view: { mode: ComparisonMode } }>;

export function OfferComparison({ view }: OfferComparisonProps) {
  if (view.mode === 'print') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <ComparisonToolbar mode="print" />
        <PrintSheet>
          <div className="@container flex min-w-0 flex-col gap-6">
            <ComparisonHeading />
            <ComparisonBody mode="print" />
          </div>
        </PrintSheet>
      </div>
    );
  }
  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <ComparisonHeading />
        <ComparisonToolbar mode="screen" />
      </div>
      <ComparisonBody mode="screen" />
    </div>
  );
}
