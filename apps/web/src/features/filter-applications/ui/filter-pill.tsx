'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/checkbox';
import { MENU_LABEL } from '@/shared/ui/field-surface';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import type { ChoiceOption } from '@/shared/ui/radio-group';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

const PILL = {
  base: cn(
    'touch-target flex h-8.5 flex-none items-center gap-2 rounded-md px-3 text-[12.5px] transition-colors duration-(--duration-instant) ease-standard',
    TOUCH_HEIGHT,
  ),
  idle: 'bg-surface text-ink-2 inset-ring inset-ring-line hover:bg-surface-2 active:bg-surface-3',
  picked: 'bg-accent-tint font-semibold text-accent-ink hover:bg-accent/15 active:bg-accent/20',
} as const;

const CHOICE_GRID = { 1: 'grid grid-cols-1', 2: 'grid grid-cols-2 gap-x-4' } as const;

const LEGEND = cn(MENU_LABEL, 'px-0');

export type ChoiceChecksProps<Value extends string> = Readonly<{
  legend: string;
  options: readonly ChoiceOption<Value>[];
  picked: readonly Value[] | undefined;
  onToggle: (value: Value) => void;
  columns?: keyof typeof CHOICE_GRID;
}>;

export type FilterPillProps = Readonly<{
  pill: { label: string; picked: boolean };
  menu: string;
  children: ReactNode;
}>;

export function FilterPill({ pill, menu, children }: FilterPillProps) {
  return (
    <Popover>
      <PopoverTrigger className={cn(PILL.base, pill.picked ? PILL.picked : PILL.idle)}>
        {pill.label}
        <ChevronDown aria-hidden size={15} className={pill.picked ? 'opacity-75' : 'text-ink-3'} />
      </PopoverTrigger>
      <PopoverContent aria-label={menu} className="flex w-76 max-w-[calc(100vw-16px)] flex-col">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function ChoiceChecks<Value extends string>({
  legend,
  options,
  picked,
  onToggle,
  columns = 2,
}: ChoiceChecksProps<Value>) {
  return (
    <fieldset className={CHOICE_GRID[columns]}>
      <legend className={LEGEND}>{legend}</legend>
      {options.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          checked={picked?.includes(option.value) ?? false}
          onCheckedChange={() => {
            onToggle(option.value);
          }}
        />
      ))}
    </fieldset>
  );
}
