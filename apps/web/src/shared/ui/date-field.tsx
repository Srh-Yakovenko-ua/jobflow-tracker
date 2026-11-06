'use client';

import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { uk } from '@/shared/i18n';
import { formatDay } from '@/shared/lib/calendar-month';
import { cn } from '@/shared/lib/cn';

import { Calendar, type CalendarDays, type CalendarSelection } from './calendar';
import { fieldLabelId, useField } from './field';
import { FIELD_SURFACE } from './field-surface';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type DateFieldProps = Readonly<{ selection: CalendarSelection; days: CalendarDays }>;

const COPY = uk.calendar;

const TRIGGER = cn(
  FIELD_SURFACE.self,
  FIELD_SURFACE.height.field,
  'group touch-target flex w-full items-center gap-2.25 px-3 text-left data-[state=open]:bg-surface data-[state=open]:focus-halo',
);

function focusTabbableDay(event: Event) {
  event.preventDefault();
  if (!(event.target instanceof HTMLElement)) return;
  event.target.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')?.focus();
}

export function DateField({ selection, days }: DateFieldProps) {
  const field = useField();
  const valueId = useId();
  const [open, setOpen] = useState(false);
  const labelledBy = field.id === undefined ? undefined : `${fieldLabelId(field.id)} ${valueId}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-focus="halo"
        data-invalid={field['aria-invalid']}
        {...field}
        aria-labelledby={labelledBy}
        className={TRIGGER}
      >
        <CalendarIcon aria-hidden className="flex-none text-ink-3" />
        <span
          id={valueId}
          className={cn('flex-1 truncate tabular-nums', selection.value === null && 'text-ink-3')}
        >
          {selection.value === null ? COPY.placeholder : formatDay(selection.value)}
        </span>
        <ChevronDown
          aria-hidden
          size={14}
          className="flex-none text-ink-3 transition-transform duration-(--duration-base) ease-standard group-data-[state=open]:rotate-180 group-data-[state=open]:text-accent"
        />
      </PopoverTrigger>
      <PopoverContent
        aria-label={COPY.label}
        onOpenAutoFocus={focusTabbableDay}
        className="min-w-73 rounded-xl shadow-e3"
      >
        <Calendar
          selection={selection}
          days={days}
          done={{
            onDone: () => {
              setOpen(false);
            },
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
