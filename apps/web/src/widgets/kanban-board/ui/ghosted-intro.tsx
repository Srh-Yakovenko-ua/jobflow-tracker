'use client';

import type { TimingsResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { timingsQueryOptions } from '@/entities/analytics';
import { BulkFollowupSheet, freshGhostsOf, useBulkFollowups } from '@/features/generate-followup';
import { type GhostMarket, uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { percentOf } from '@/shared/lib/percent';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { OutcomeColumn } from './outcome-lane';

export type GhostedIntroProps = Readonly<{ column: OutcomeColumn }>;

const COPY = uk.ghosted;

const ACTION = cn('h-auto max-w-full min-h-control-md py-1.5 whitespace-normal', TOUCH_HEIGHT);

function marketOf(timings: TimingsResponse | undefined): GhostMarket | null {
  if (timings === undefined) return null;
  const { rate, gap } = timings.ghostRate;
  if (rate.status !== 'ok') return null;
  return {
    percent: percentOf(rate.value),
    points: gap?.points ?? 0,
    position: gap?.position ?? 'within',
  };
}

export function GhostedIntro({ column }: GhostedIntroProps) {
  const timings = useQuery(timingsQueryOptions());
  const queue = useBulkFollowups();
  const [open, setOpen] = useState(false);
  const fresh = freshGhostsOf(column.items ?? []);
  const action = fresh.length > 0 && (
    <Button
      variant="secondary"
      className={ACTION}
      onClick={() => {
        if (queue.rows.length === 0) queue.start(fresh);
        setOpen(true);
      }}
    >
      {COPY.action(fresh.length)}
    </Button>
  );
  return (
    <>
      <EmptyState
        content={{
          eyebrow: COPY.eyebrow(column.count),
          title: COPY.title(column.count),
          hint: COPY.hint(marketOf(timings.data)),
        }}
        slots={{ action }}
        view={{ tone: 'ghosted' }}
      />
      {open && (
        <BulkFollowupSheet
          queue={queue}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
