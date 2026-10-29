'use client';

import { Check, Minus } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { CHECK_BOX, CHOICE_ROW } from './field-surface';

export type CheckboxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, 'children'> & {
  label: ReactNode;
};

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={CHOICE_ROW}>
      <CheckboxPrimitive.Root
        {...props}
        className={cn(
          CHECK_BOX.base,
          CHECK_BOX.off,
          'group touch-target data-[state=checked]:bg-accent data-[state=checked]:text-surface data-[state=checked]:inset-ring-0 data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-surface data-[state=indeterminate]:inset-ring-0 data-disabled:bg-surface-3 data-disabled:text-ink-3',
          className,
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check
            aria-hidden
            size={12}
            strokeWidth={2.4}
            className="group-data-[state=indeterminate]:hidden"
          />
          <Minus
            aria-hidden
            size={12}
            strokeWidth={2.4}
            className="hidden group-data-[state=indeterminate]:block"
          />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  );
}
