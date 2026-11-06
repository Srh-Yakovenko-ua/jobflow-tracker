'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { ICON_ACTION } from './field-surface';
import { Tooltip } from './tooltip';

export type IconActionProps = Readonly<
  Omit<ComponentProps<'button'>, 'aria-label' | 'children' | 'type'> & {
    label: string;
    icon: LucideIcon;
  }
>;

export function IconAction({ label, icon: Icon, className, ...props }: IconActionProps) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        {...props}
        aria-label={label}
        className={cn(ICON_ACTION, 'size-6 active:bg-surface-3 active:text-ink', className)}
      >
        <Icon aria-hidden size={16} strokeWidth={1.9} />
      </button>
    </Tooltip>
  );
}
