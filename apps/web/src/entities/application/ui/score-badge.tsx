import { CircleAlert, Clock } from 'lucide-react';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { type ScoreSource, type ScoreState, scoreStateOf, type ScoreTier } from '../lib/score-tier';

const COPY = uk.application.score;

const PILL =
  'inline-flex flex-none items-center gap-1 rounded-pill px-2.25 py-0.75 text-[12.5px] leading-[normal] font-semibold tabular-nums';

const QUIET = 'bg-surface-2 text-ink-3 inset-ring inset-ring-line-soft';

const TIER_CLASS: Record<ScoreTier, string> = {
  strong: 'bg-accent-tint text-accent-ink',
  mid: 'bg-surface-2 text-ink-2 inset-ring inset-ring-line-soft',
  weak: QUIET,
};

const MUTED = 'bg-transparent text-ink-3 inset-ring inset-ring-line';

type BadgeLook = { className: string; label: string; content: ReactNode };

const STATUS_LOOK: Record<Exclude<ScoreState['kind'], 'score'>, BadgeLook> = {
  queued: {
    className: QUIET,
    label: COPY.queued,
    content: (
      <>
        <Clock aria-hidden size={14} />
        {COPY.pending}
      </>
    ),
  },
  processing: {
    className:
      'bg-linear-to-r from-surface-3 via-surface to-surface-3 bg-size-[340px_100%] text-ink-3 inset-ring inset-ring-line-soft motion-safe:animate-shimmer',
    label: COPY.processing,
    content: COPY.pending,
  },
  failed: {
    className: 'bg-danger/8 text-danger',
    label: COPY.failed,
    content: <CircleAlert aria-hidden size={14} />,
  },
  none: {
    className: 'border-[1.5px] border-dashed border-ink-3/35 py-[1.5px] text-ink-3',
    label: COPY.none,
    content: COPY.empty,
  },
};

export type ScoreBadgeProps = Readonly<{
  application: ScoreSource;
  view?: { muted?: boolean };
}>;

export function ScoreBadge({ application, view }: ScoreBadgeProps) {
  const state = scoreStateOf(application);
  const look: BadgeLook =
    state.kind === 'score'
      ? {
          className: cn(TIER_CLASS[state.tier], view?.muted === true && MUTED),
          label: COPY.value(state.score),
          content: state.score,
        }
      : STATUS_LOOK[state.kind];
  return (
    <span role="img" aria-label={look.label} className={cn(PILL, look.className)}>
      {look.content}
    </span>
  );
}
