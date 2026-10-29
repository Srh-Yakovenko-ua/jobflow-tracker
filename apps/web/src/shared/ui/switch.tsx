'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { CHOICE_ROW } from './field-surface';

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, 'children'> & {
  label: ReactNode;
};

export function Switch({ label, className, ...props }: SwitchProps) {
  return (
    <label className={cn(CHOICE_ROW, 'gap-3')}>
      <SwitchPrimitive.Root
        {...props}
        className={cn(
          'touch-target h-6.5 w-10.5 flex-none rounded-pill bg-line transition-colors duration-(--duration-fast) ease-standard data-[state=checked]:bg-accent data-disabled:bg-surface-3',
          className,
        )}
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.75 rounded-pill bg-surface shadow-e1 transition-[translate] duration-(--duration-spring) ease-spring data-[state=checked]:translate-x-4.75" />
      </SwitchPrimitive.Root>
      {label}
    </label>
  );
}
