'use client';

import type { RefCallback } from 'react';

import { cn } from '@/shared/lib/cn';

export type CalendarChoice = Readonly<{
  value: number;
  label: string;
  name?: string | undefined;
  muted?: boolean;
}>;

export type CalendarChoicePick = Readonly<{
  current: number;
  onPick: (value: number) => void;
}>;

export type CalendarChoiceGridProps = Readonly<{
  label: string;
  choices: readonly CalendarChoice[];
  pick: CalendarChoicePick;
  focusTarget: RefCallback<HTMLButtonElement>;
}>;

const CHOICE =
  'flex h-control-lg items-center justify-center rounded-md text-[13px] tabular-nums transition-colors duration-(--duration-instant) ease-standard';

type ChoiceLook = Readonly<{ current: boolean; muted: boolean | undefined }>;

function toneOf({ current, muted }: ChoiceLook): string {
  if (current) return 'bg-accent font-semibold text-surface';
  return cn(
    'bg-surface-2 inset-ring inset-ring-line-soft hover:bg-surface-3',
    muted ? 'text-ink-3' : 'text-ink',
  );
}

export function CalendarChoiceGrid({ label, choices, pick, focusTarget }: CalendarChoiceGridProps) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-1.25">
      {choices.map((choice) => {
        const current = choice.value === pick.current;
        return (
          <button
            key={choice.value}
            ref={current ? focusTarget : undefined}
            type="button"
            aria-label={choice.name}
            aria-current={current || undefined}
            onClick={() => {
              pick.onPick(choice.value);
            }}
            className={cn(CHOICE, toneOf({ current, muted: choice.muted }))}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
