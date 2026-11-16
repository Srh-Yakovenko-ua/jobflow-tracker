'use client';

import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { settingsHref } from '@/shared/lib/settings-anchors';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { PopoverContent } from '@/shared/ui/popover';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useRhythmEffect } from '../model/use-rhythm-effect';

export type RhythmPopoverActions = Readonly<{
  onAccept: (goal: number) => void;
  onClose: () => void;
}>;

export type RhythmPopoverProps = Readonly<{
  suggestedGoal: number | null;
  actions: RhythmPopoverActions;
}>;

type SuggestionProps = Readonly<{ goal: number; actions: RhythmPopoverActions }>;

const COPY = uk.rhythm.popover;

const CONTENT =
  'flex w-76 max-w-[calc(100vw-16px)] origin-(--radix-popover-content-transform-origin) flex-col gap-3';

function Suggestion({ goal, actions }: SuggestionProps) {
  const weeksSooner = useRhythmEffect(goal);
  return (
    <>
      <p className="text-[14px] font-semibold text-ink tabular-nums">{COPY.goal(goal)}</p>
      {weeksSooner !== null && (
        <p className="animate-fade-in text-body text-ink-2 tabular-nums">
          {uk.notifications.rhythmWeekClosed.suggestion({ goal, weeksSooner })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className={TOUCH_HEIGHT}
          onClick={() => {
            actions.onAccept(goal);
          }}
        >
          {COPY.accept}
        </Button>
        <Button variant="ghost" size="sm" className={TOUCH_HEIGHT} onClick={actions.onClose}>
          {COPY.later}
        </Button>
      </div>
    </>
  );
}

export function RhythmPopover({ suggestedGoal, actions }: RhythmPopoverProps) {
  return (
    <PopoverContent aria-label={COPY.title} className={CONTENT}>
      {suggestedGoal === null ? (
        <Link
          href={settingsHref('rhythm')}
          onClick={actions.onClose}
          className={cn(
            buttonLinkClasses({ variant: 'ghost', size: 'sm' }),
            TOUCH_HEIGHT,
            'self-start',
          )}
        >
          {COPY.configure}
        </Link>
      ) : (
        <Suggestion goal={suggestedGoal} actions={actions} />
      )}
    </PopoverContent>
  );
}
