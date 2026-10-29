'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

export const Tabs = TabsPrimitive.Root;

export const TabsContent = TabsPrimitive.Content;

export type TabsListProps = ComponentProps<typeof TabsPrimitive.List>;

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      {...props}
      className={cn(
        'flex flex-wrap items-center gap-0.5 rounded-lg bg-surface-2 px-3.5 py-2.5',
        className,
      )}
    />
  );
}

export type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger> & {
  count?: number | undefined;
};

export function TabsTrigger({ count, children, className, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      {...props}
      className={cn(
        'touch-target flex h-8 items-center gap-2 rounded-md px-3 font-ui text-[13px] font-medium text-ink-2 transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-standard hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-e1',
        className,
      )}
    >
      {children}
      {count !== undefined && (
        <>
          {' '}
          <span className="flex h-4.25 min-w-4.25 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-semibold text-surface tabular-nums">
            {count}
          </span>
        </>
      )}
    </TabsPrimitive.Trigger>
  );
}
