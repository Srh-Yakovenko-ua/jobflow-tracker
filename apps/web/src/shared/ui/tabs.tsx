'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import { type ComponentProps, createContext, use, useId, useState } from 'react';

import { cn } from '@/shared/lib/cn';

import { ActiveIndicator } from './active-indicator';
import { COUNT_PILL } from './count-pill';

type TabsSelection = Readonly<{ value: string | undefined; group: string }>;

const TabsSelectionContext = createContext<TabsSelection>({ value: undefined, group: '' });

export type TabsProps = ComponentProps<typeof TabsPrimitive.Root>;

export function Tabs({ onValueChange, ...props }: TabsProps) {
  const [picked, setPicked] = useState(props.defaultValue);
  const groupId = useId();
  return (
    <TabsSelectionContext value={{ value: props.value ?? picked, group: groupId }}>
      <TabsPrimitive.Root
        {...props}
        onValueChange={(next) => {
          setPicked(next);
          onValueChange?.(next);
        }}
      />
    </TabsSelectionContext>
  );
}

export const TabsContent = TabsPrimitive.Content;

export type TabsListProps = ComponentProps<typeof TabsPrimitive.List>;

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      {...props}
      className={cn(
        'isolate flex flex-wrap items-center gap-0.5 rounded-lg bg-surface-2 px-3.5 py-2.5',
        className,
      )}
    />
  );
}

export type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger> & {
  count?: number | undefined;
};

export function TabsTrigger({ count, children, className, ...props }: TabsTriggerProps) {
  const selection = use(TabsSelectionContext);
  return (
    <TabsPrimitive.Trigger
      {...props}
      className={cn(
        'touch-target flex h-8 items-center gap-2 rounded-md px-3 font-ui text-[13px] font-medium text-ink-2 transition-colors duration-(--duration-fast) ease-standard hover:text-ink active:text-ink data-[state=active]:text-ink',
        className,
      )}
    >
      {selection.value === props.value && <ActiveIndicator group={selection.group} />}
      {children}
      {count !== undefined && (
        <>
          {' '}
          <span className={COUNT_PILL}>{count}</span>
        </>
      )}
    </TabsPrimitive.Trigger>
  );
}
