'use client';

import type { SummaryArchiveItem } from '@jobflow/shared';
import Link from 'next/link';
import { useId } from 'react';

import { uk } from '@/shared/i18n';
import { monthNameOf, yearOf } from '@/shared/lib/year-month';
import { GrowBar } from '@/shared/ui/grow-bar';

const COPY = uk.summary.archive;

function PlanProgress({ plan }: Readonly<{ plan: SummaryArchiveItem['plan'] }>) {
  if (plan === null) return <span className="text-[12.5px] text-ink-3">{COPY.noPlan}</span>;
  return (
    <span className="flex items-center gap-3">
      <span className="text-[12.5px] text-ink-2 tabular-nums">
        {COPY.progress(plan.done, plan.items)}
      </span>
      <span aria-hidden className="flex h-1.5 w-20 overflow-hidden rounded-pill bg-surface-3">
        <GrowBar share={plan.items === 0 ? 0 : plan.done / plan.items} className="bg-offer" />
      </span>
    </span>
  );
}

export type SummaryArchiveProps = Readonly<{ items: readonly SummaryArchiveItem[] }>;

export function SummaryArchive({ items }: SummaryArchiveProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
      <h2 id={titleId} className="eyebrow text-ink-3">
        {COPY.title}
      </h2>
      <ul className="flex flex-col bg-surface shadow-e1">
        {items.map((item) => (
          <li
            key={item.aiJobId}
            className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-soft px-4 py-2 last:border-b-0"
          >
            <Link
              href={`/analytics/summary/${item.month}`}
              className="inline-flex min-h-11 items-center text-[14px] font-semibold text-ink underline-offset-4 transition-colors duration-(--duration-instant) ease-standard hover:text-link active:text-link hover:underline active:underline"
            >
              {COPY.month(monthNameOf(item.month), yearOf(item.month))}
            </Link>
            <PlanProgress plan={item.plan} />
          </li>
        ))}
      </ul>
    </section>
  );
}
