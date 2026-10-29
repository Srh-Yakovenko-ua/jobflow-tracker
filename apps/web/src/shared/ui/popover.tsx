'use client';

import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { OVERLAY_SURFACE } from './field-surface';

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
        className={cn(OVERLAY_SURFACE, 'p-3.5', className)}
      />
    </PopoverPrimitive.Portal>
  );
}
