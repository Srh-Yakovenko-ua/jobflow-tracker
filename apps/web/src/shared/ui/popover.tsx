'use client';

import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

export const Popover = PopoverPrimitive.Root;

export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverAnchor = PopoverPrimitive.Anchor;

export type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Content> & {
  'aria-label': string;
};

export function PopoverContent({ className, ...props }: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align="start"
        sideOffset={6}
        collisionPadding={8}
        {...props}
        className={cn(
          'z-50 rounded-lg bg-surface p-3.5 font-ui text-ink shadow-e2 inset-ring inset-ring-line-soft animate-pop-in',
          className,
        )}
      />
    </PopoverPrimitive.Portal>
  );
}
