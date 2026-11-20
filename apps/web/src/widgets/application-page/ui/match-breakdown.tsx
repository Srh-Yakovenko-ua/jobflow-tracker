'use client';

import { motion } from 'motion/react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { PERCENT } from '@/shared/lib/percent';
import { GrowBar } from '@/shared/ui/grow-bar';
import { ROW } from '@/shared/ui/list-stagger';
import { StaggeredList, type StaggeredListTitle } from '@/shared/ui/staggered-list';

import { type MatchRow, matchRowsOf } from '../lib/match-rows';
import type { ScoredMatch } from '../lib/match-view';

export type MatchBreakdownProps = Readonly<{ match: ScoredMatch }>;

type MatchListProps = Readonly<{
  title: StaggeredListTitle;
  rows: readonly MatchRow[];
  className?: string;
}>;

const COPY = uk.applicationPage.match;

function MatchBar({ score }: Readonly<{ score: number }>) {
  return (
    <span aria-hidden className="flex h-3 overflow-hidden rounded-pill bg-line-soft">
      <GrowBar
        key={score}
        share={Math.min(score, PERCENT) / PERCENT}
        className="block h-full rounded-pill bg-accent"
      />
    </span>
  );
}

function MatchList({ title, rows, className }: MatchListProps) {
  return (
    <StaggeredList
      label={title}
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
    </StaggeredList>
  );
}

export function MatchBreakdown({ match }: MatchBreakdownProps) {
  const rows = matchRowsOf(match);
  return (
    <div className="flex flex-col gap-5">
      <MatchBar score={match.score} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-6">
        <MatchList title={{ text: COPY.matched, marker: 'filled' }} rows={rows.matched} />
        <div className="flex flex-col gap-2.5">
          <MatchList
            title={{ text: COPY.missing, marker: 'dashed' }}
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
