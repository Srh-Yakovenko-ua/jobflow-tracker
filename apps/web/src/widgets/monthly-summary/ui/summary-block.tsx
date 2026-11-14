'use client';

import type { Summary } from '@jobflow/shared';
import { useId } from 'react';

import { useUserTimeZone } from '@/entities/user';
import { RegenerateSummaryButton } from '@/features/regenerate-summary';
import { SaveSummaryPlanButton } from '@/features/save-summary-plan';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatIncidentTime } from '@/shared/lib/state-format';
import { monthInOf, monthNameOf, nextMonthOf } from '@/shared/lib/year-month';
import { NumberedAction } from '@/shared/ui/numbered-action';

import { SummaryText, type SummaryTextMode } from './summary-text';

const COPY = uk.summary;

const SLAB =
  'grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-7.5 rounded-[18px] bg-scrim p-7 text-ink max-sm:p-5';

export type SummaryBlockView = { mode: SummaryTextMode; regenerate: boolean };

export type SummaryBlockProps = Readonly<{ summary: Summary; view: SummaryBlockView }>;

function ReadyRow({ summary }: Readonly<{ summary: Summary }>) {
  const timeZone = useUserTimeZone();
  const stamp = formatIncidentTime({ at: new Date(summary.generatedAt), timeZone });
  return (
    <div className="flex flex-wrap items-baseline gap-3.5">
      <span className="eyebrow text-ink-3">{COPY.eyebrowMonth(monthNameOf(summary.month))}</span>
      <span aria-hidden className="h-px min-w-7.5 flex-1 self-center bg-line-soft" />
      <span className="flex items-center gap-2 text-[11.5px] text-ink-3 tabular-nums">
        <span aria-hidden className="size-1.75 flex-none rounded-pill bg-offer" />
        {COPY.ready(stamp)}
      </span>
    </div>
  );
}

type ActionListProps = Readonly<{ summary: Summary; labelId: string }>;

function ActionList({ summary, labelId }: ActionListProps) {
  return (
    <ol aria-labelledby={labelId} className="flex flex-col gap-3.25">
      {summary.actions.map((action, index) => (
        <NumberedAction
          key={action.title}
          action={{
            position: index + 1,
            title: action.title,
            lines: [action.why, action.expectedEffect],
          }}
          view={{ tone: 'link' }}
        />
      ))}
    </ol>
  );
}

function SummaryActions({ summary, view }: SummaryBlockProps) {
  const labelId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p id={labelId} className="eyebrow text-ink-3">
        {COPY.actions(monthInOf(nextMonthOf(summary.month)))}
      </p>
      <ActionList summary={summary} labelId={labelId} />
      <div className="flex flex-wrap items-center gap-2.25 pt-0.5">
        <SaveSummaryPlanButton summary={summary} />
        {view.regenerate && <RegenerateSummaryButton />}
      </div>
    </div>
  );
}

export function SummaryBlock({ summary, view }: SummaryBlockProps) {
  const headingId = useId();
  const Heading = view.mode === 'page' ? 'h2' : 'h3';
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
      <ReadyRow summary={summary} />
      <div className="rounded-[18px] shadow-e3">
        <div data-theme="dark" className={SLAB}>
          <div className="flex min-w-0 flex-col gap-3.5">
            <Heading
              id={headingId}
              className={cn(
                'font-display leading-[1.2] font-medium tracking-[-0.034em] text-pretty text-ink',
                view.mode === 'page' ? 'text-[26px]' : 'text-[23px]',
              )}
            >
              {COPY.heading(monthNameOf(summary.month))}
            </Heading>
            <SummaryText text={summary.text} view={{ mode: view.mode }} />
          </div>
          <SummaryActions summary={summary} view={view} />
        </div>
      </div>
    </section>
  );
}
