'use client';

import { useRef, useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { Chip } from './chip';
import { ClearButton } from './clear-button';
import { ComboboxMenu, type ComboboxView } from './combobox-menu';
import { useField } from './field';
import { FIELD_SURFACE, type SelectOptionGroup } from './field-surface';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover';
import { SelectIndicators } from './select-indicators';

export type { ComboboxView } from './combobox-menu';

export type ComboboxSelection =
  | { mode: 'single'; value: string; onValueChange: (value: string) => void }
  | { mode: 'multi'; value: readonly string[]; onValueChange: (value: string[]) => void };

export type ComboboxProps = Readonly<{
  groups: readonly SelectOptionGroup[];
  selection: ComboboxSelection;
  view: ComboboxView;
  onCreate?: (query: string) => void;
}>;

const CHIP_LIMIT = 4;

type ChipsProps = Readonly<{
  values: readonly string[];
  labelOf: (value: string) => string;
  onRemove: (value: string) => void;
}>;

function Chips({ values, labelOf, onRemove }: ChipsProps) {
  const hidden = values.length - CHIP_LIMIT;
  return (
    <>
      {values.slice(0, CHIP_LIMIT).map((value) => (
        <Chip
          key={value}
          label={labelOf(value)}
          tone="accent"
          onRemove={() => {
            onRemove(value);
          }}
        />
      ))}
      {hidden > 0 && (
        <span className="relative z-10 px-1 text-[12px] font-semibold text-ink-2 tabular-nums">
          {`+${String(hidden)}`}
        </span>
      )}
    </>
  );
}

function pickedOf(selection: ComboboxSelection): readonly string[] {
  if (selection.mode === 'multi') return selection.value;
  return selection.value === '' ? [] : [selection.value];
}

function toggled(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function Combobox({ groups, selection, view, onCreate }: ComboboxProps) {
  const field = useField();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const picked = pickedOf(selection);
  const options = groups.flatMap((group) => group.options);
  const labelOf = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const onPick = (value: string) => {
    if (selection.mode === 'multi') {
      selection.onValueChange(toggled(selection.value, value));
      return;
    }
    selection.onValueChange(value);
    setOpen(false);
  };
  const clear = () => {
    if (selection.mode === 'multi') selection.onValueChange([]);
    else selection.onValueChange('');
    triggerRef.current?.focus();
  };
  const summary = selection.mode === 'single' && picked[0] ? labelOf(picked[0]) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          data-invalid={field['aria-invalid']}
          className={cn(
            FIELD_SURFACE.shell,
            'group min-h-9.5 flex-wrap gap-1.25 rounded-[10px] py-1.25 pr-1.5 pl-2.75',
          )}
        >
          {selection.mode === 'multi' && (
            <Chips
              values={selection.value}
              labelOf={labelOf}
              onRemove={(value) => {
                selection.onValueChange(toggled(selection.value, value));
                triggerRef.current?.focus();
              }}
            />
          )}
          <PopoverTrigger
            ref={triggerRef}
            role="combobox"
            data-focus="halo"
            {...field}
            className={cn(FIELD_SURFACE.trigger, 'min-h-7 min-w-2.5')}
          >
            <span className={cn('truncate', summary === undefined && 'text-ink-3')}>
              {summary ?? (picked.length === 0 ? view.placeholder : undefined)}
            </span>
          </PopoverTrigger>
          {picked.length > 0 && view.clearable !== false && (
            <ClearButton
              label={selection.mode === 'multi' ? uk.ui.clearAll : uk.ui.clear}
              onClear={clear}
            />
          )}
          <SelectIndicators />
        </div>
      </PopoverAnchor>
      <PopoverContent aria-label={view.label} className="w-(--radix-popover-trigger-width) p-1.5">
        <ComboboxMenu
          groups={groups}
          selection={{ mode: selection.mode, picked }}
          actions={{ onPick, onCreate }}
          view={view}
        />
      </PopoverContent>
    </Popover>
  );
}
