'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { rhythmQueryOptions } from '@/entities/user';
import { useUpdateSettingsMutation } from '@/features/update-settings';
import { cn } from '@/shared/lib/cn';
import { GrowBar } from '@/shared/ui/grow-bar';
import { Popover, PopoverTrigger } from '@/shared/ui/popover';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { type RhythmDot, rhythmSummaryOf } from '../model/rhythm-summary';
import { RhythmPopover } from './rhythm-popover';

type RhythmDotsProps = Readonly<{ dots: readonly RhythmDot[] }>;

const TRIGGER = cn(
  'touch-target flex animate-fade-in flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md px-2 py-1 text-left text-[12.5px] text-ink-2 tabular-nums transition-colors duration-(--duration-instant) ease-standard hover:bg-surface-3 active:bg-surface-3 data-[state=open]:bg-surface-3',
  TOUCH_HEIGHT,
);

function RhythmDots({ dots }: RhythmDotsProps) {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {dots.map(({ weekStart, filled }) => (
        <span
          key={weekStart}
          data-filled={filled}
          className={cn(
            'size-1.5 rounded-full transition-colors duration-(--duration-fast) ease-standard',
            filled ? 'bg-accent' : 'inset-ring inset-ring-ink-3',
          )}
        />
      ))}
    </span>
  );
}

export function RhythmWidget() {
  const rhythm = useQuery(rhythmQueryOptions());
  const { save } = useUpdateSettingsMutation();
  const [open, setOpen] = useState(false);
  const summary = rhythm.data && rhythmSummaryOf(rhythm.data);
  if (!summary) return null;
  const close = () => {
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={summary.sentence} className={TRIGGER}>
        <span aria-hidden>{summary.line}</span>
        {summary.share !== null && (
          <span aria-hidden className="flex h-1 w-16 overflow-hidden rounded-full bg-line-soft">
            <GrowBar share={summary.share} className="h-full rounded-full bg-accent" />
          </span>
        )}
        <RhythmDots dots={summary.dots} />
      </PopoverTrigger>
      <RhythmPopover
        suggestedGoal={summary.suggestedGoal}
        actions={{
          onAccept: (weeklyGoalApplications) => {
            save({ weeklyGoalApplications });
            close();
          },
          onClose: close,
        }}
      />
    </Popover>
  );
}
