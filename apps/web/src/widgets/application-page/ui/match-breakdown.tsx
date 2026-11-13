'use client';

import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { CircleDashed } from 'lucide-react';
import { motion, stagger, type Variants } from 'motion/react';
import { type ReactNode, useId } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { usePrefersReducedMotion } from '@/shared/lib/reduced-motion';
import { useDataTransition } from '@/shared/lib/use-data-transition';

import { type MatchRow, matchRowsOf } from '../lib/match-rows';
import type { ScoredMatch } from '../lib/match-view';

export type MatchBreakdownProps = Readonly<{ match: ScoredMatch }>;

type MatchListProps = Readonly<{
  title: string;
  marker: ReactNode;
  rows: readonly MatchRow[];
  className?: string;
}>;

const COPY = uk.applicationPage.match;

const PERCENT = 100;

const MS = 1000;

const ROW: Variants = { hidden: { opacity: 0, y: 4 }, shown: { opacity: 1, y: 0 } };

const LIST: Variants = {
  hidden: {},
  shown: { transition: { delayChildren: stagger(CHART_THEME.animation.stagger / MS) } },
};

const LIST_STILL: Variants = { hidden: {}, shown: {} };

function MatchBar({ score }: Readonly<{ score: number }>) {
  const transition = useDataTransition();
  return (
    <span aria-hidden className="flex h-3 overflow-hidden rounded-pill bg-line-soft">
      <motion.span
        key={score}
        className="block h-full origin-left rounded-pill bg-accent"
        style={{ width: `${String(Math.min(score, PERCENT))}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={transition}
      />
    </span>
  );
}

function MatchList({ title, marker, rows, className }: MatchListProps) {
  const titleId = useId();
  const reduced = usePrefersReducedMotion();
  return (
    <div className="flex flex-col gap-2.5">
      <h3 id={titleId} className="flex items-center gap-2 text-[13px] font-semibold">
        {marker}
        {title}
      </h3>
      <motion.ul
        aria-labelledby={titleId}
        variants={reduced ? LIST_STILL : LIST}
        initial="hidden"
        animate="shown"
        className={cn('flex flex-col gap-2 text-[14px] leading-[1.45]', className)}
      >
        {rows.map((row) => (
          <motion.li
            key={row.id}
            variants={ROW}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 pb-2 shadow-[inset_0_-1px_0_var(--line-soft)] last:pb-0 last:shadow-none"
          >
            <span className={cn('wrap-anywhere', row.ignored && 'text-ink-3')}>{row.name}</span>
            <span className="font-ui text-[12px] font-semibold text-ink-3 tabular-nums">
              {row.mark}
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

export function MatchBreakdown({ match }: MatchBreakdownProps) {
  const rows = matchRowsOf(match);
  return (
    <div className="flex flex-col gap-5">
      <MatchBar score={match.score} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-6">
        <MatchList
          title={COPY.matched}
          marker={<span aria-hidden className="size-2.25 flex-none rounded-pill bg-accent" />}
          rows={rows.matched}
        />
        <div className="flex flex-col gap-2.5">
          <MatchList
            title={COPY.missing}
            marker={
              <CircleDashed
                aria-hidden
                size={16}
                strokeWidth={1.9}
                className="flex-none text-ghosted"
              />
            }
            rows={rows.missing}
            className="text-ink-2"
          />
          <p className="pl-3 text-[13px] leading-[1.55] text-ink-3 shadow-[inset_2px_0_0_var(--line-soft)]">
            {match.explanation}
          </p>
        </div>
      </div>
    </div>
  );
}
