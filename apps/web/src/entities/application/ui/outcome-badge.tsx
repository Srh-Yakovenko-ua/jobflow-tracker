import { type InactiveStage, STAGE_LABELS } from '@jobflow/shared';
import { CircleDashed, CircleMinus, CircleSlash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

export type OutcomeBadgeProps = Readonly<{ outcome: InactiveStage }>;

const OUTCOME_LOOK: Record<InactiveStage, { badge: string; marker: ReactNode }> = {
  offer: {
    badge: 'bg-offer/15 text-offer',
    marker: <span aria-hidden className="size-2.5 flex-none rounded-full bg-offer" />,
  },
  rejected: {
    badge: 'bg-rejected/15 text-ink-2',
    marker: <CircleMinus aria-hidden className="flex-none text-rejected" />,
  },
  ghosted: {
    badge: 'bg-ghosted/15 text-ink-3 inset-ring inset-ring-line',
    marker: <CircleDashed aria-hidden className="flex-none text-ghosted" />,
  },
  withdrawn: {
    badge: 'bg-withdrawn/15 text-ink-2',
    marker: <CircleSlash2 aria-hidden className="flex-none text-withdrawn" />,
  },
};

export function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  const look = OUTCOME_LOOK[outcome];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-pill px-3.75 py-2 text-[14px] leading-[normal] font-semibold',
        look.badge,
      )}
    >
      {look.marker}
      {STAGE_LABELS[outcome].labelUk}
    </span>
  );
}
