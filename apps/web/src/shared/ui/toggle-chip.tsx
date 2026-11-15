'use client';

import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { TOUCH_HEIGHT } from './touch-height';

const CHIP = {
  base: cn(
    'touch-target flex h-7.5 flex-none items-center gap-1.75 rounded-full px-2.75 text-[12px] font-medium whitespace-nowrap transition-colors duration-(--duration-instant) ease-standard',
    TOUCH_HEIGHT,
  ),
  idle: 'bg-surface-2 text-ink-2 inset-ring inset-ring-line hover:bg-surface-3 active:bg-surface-3',
  picked:
    'bg-accent text-surface shadow-accent hover:bg-accent-press active:bg-accent-press dark:hover:text-paper dark:active:text-paper',
} as const;

export type ToggleChipProps = Omit<ComponentProps<'button'>, 'type' | 'aria-pressed'> & {
  pressed: boolean;
};

export function ToggleChip({ pressed, className, ...props }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...props}
      className={cn(CHIP.base, pressed ? CHIP.picked : CHIP.idle, className)}
    />
  );
}
