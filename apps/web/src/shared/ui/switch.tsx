'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { CHOICE_ROW } from './field-surface';

export type SwitchPlacement = 'start' | 'end';

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, 'children'> & {
  label: ReactNode;
  placement?: SwitchPlacement;
};

const ROW: Record<SwitchPlacement, string> = {
  start: 'gap-3',
  end: 'w-full justify-between gap-5',
};

export function Switch({ label, placement = 'start', className, ...props }: SwitchProps) {
  const toggle = (
    <SwitchPrimitive.Root
      {...props}
      className={cn(
        'touch-target h-6.5 w-10.5 flex-none rounded-pill bg-line transition-colors duration-(--duration-fast) ease-standard data-[state=checked]:bg-accent data-disabled:bg-surface-3',
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.75 rounded-pill bg-surface shadow-e1 transition-[translate] duration-(--duration-spring) ease-spring data-[state=checked]:translate-x-4.75" />
    </SwitchPrimitive.Root>
  );
  return (
    <label className={cn(CHOICE_ROW, ROW[placement])}>
      {placement === 'start' && toggle}
      {label}
      {placement === 'end' && toggle}
    </label>
  );
}
