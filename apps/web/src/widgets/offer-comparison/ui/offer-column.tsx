'use client';

import Link from 'next/link';
import { useId } from 'react';

import { formatAmount, formatSalaryRange, ScoreBadge } from '@/entities/application';
import { uk } from '@/shared/i18n';

import type { ScoredOffer } from '../lib/offer-score';
import { type OfferNotesBinding, OfferNotesFields, OfferNotesText } from './offer-notes';

const COPY = uk.offerCompare.column;

const COLUMN =
  'flex h-full min-w-0 flex-col gap-4 rounded-2xl bg-surface bg-linear-180 from-offer/8 to-surface to-40% p-3.5 shadow-e1 print:break-inside-avoid print:shadow-none print:inset-ring print:inset-ring-line-soft';

const COMPANY_LINK =
  'touch-target text-ink transition-colors duration-(--duration-instant) ease-standard hover:text-link';

export type RankedOffer = ScoredOffer & Readonly<{ rank: number }>;

export type OfferColumnProps = Readonly<{
  ranked: RankedOffer;
  notes: OfferNotesBinding;
  view: { readOnly: boolean };
}>;

function SalaryValue({ ranked }: Readonly<{ ranked: RankedOffer }>) {
  const range = formatSalaryRange(ranked.offer);
  if (range === null) return uk.application.salary.unknown;
  const usdNet =
    ranked.usdNet === null ? COPY.notConverted : COPY.usdNet(formatAmount(ranked.usdNet));
  return (
    <span className="flex flex-col">
      <span className="font-semibold text-ink">{usdNet}</span>
      <span className="text-ink-3">{range}</span>
    </span>
  );
}

function OfferFacts({ ranked }: Readonly<{ ranked: RankedOffer }>) {
  const { offer } = ranked;
  return (
    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-[13px] leading-[1.4] tabular-nums">
      <dt className="text-ink-3">{COPY.salary}</dt>
      <dd className="wrap-break-word">
        <SalaryValue ranked={ranked} />
      </dd>
      <dt className="text-ink-3">{COPY.workMode}</dt>
      <dd className="text-ink">
        {offer.workMode === null ? COPY.unknown : uk.application.workModes[offer.workMode]}
      </dd>
      <dt className="text-ink-3">{COPY.location}</dt>
      <dd className="wrap-break-word text-ink">{offer.location ?? COPY.unknown}</dd>
      <dt className="text-ink-3">{COPY.matchScore}</dt>
      <dd>
        <ScoreBadge application={{ matchScore: offer.matchScore, aiStatus: null }} />
      </dd>
    </dl>
  );
}

function ColumnHead({ ranked, headingId }: Readonly<{ ranked: RankedOffer; headingId: string }>) {
  const { offer, rank, score } = ranked;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-pill bg-surface px-2 py-0.5 text-[12px] font-semibold text-offer tabular-nums">
          {COPY.rank(rank)}
        </span>
        <span className="flex items-baseline gap-1 tabular-nums">
          <span className="font-display text-[28px] leading-none font-medium text-ink">
            {score ?? COPY.noScore}
          </span>
          <span className="text-[12px] text-ink-3">{COPY.score}</span>
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 id={headingId} className="text-[16px] leading-[1.3] font-semibold wrap-break-word">
          <Link href={`/applications/${offer.id}`} className={COMPANY_LINK}>
            {offer.company}
          </Link>
        </h3>
        <p className="text-[13px] leading-[1.4] wrap-break-word text-ink-2">{offer.position}</p>
      </div>
    </>
  );
}

export function OfferColumn({ ranked, notes, view }: OfferColumnProps) {
  const headingId = useId();
  return (
    <article aria-labelledby={headingId} className={COLUMN}>
      <ColumnHead ranked={ranked} headingId={headingId} />
      <OfferFacts ranked={ranked} />
      {view.readOnly ? <OfferNotesText notes={notes.value} /> : <OfferNotesFields notes={notes} />}
    </article>
  );
}
