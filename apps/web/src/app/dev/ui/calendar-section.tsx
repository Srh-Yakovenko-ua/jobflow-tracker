'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Calendar, type CalendarDays } from '@/shared/ui/calendar';
import { DateField } from '@/shared/ui/date-field';

import { GallerySection, Note, PANEL, Specimen } from './gallery';

const COPY = uk.devUi.calendar;

const SPECIMEN_DAYS: CalendarDays = {
  today: '2026-09-07',
  marked: { '2026-08-20': 1, '2026-08-28': 1, '2026-09-01': 1, '2026-09-03': 1, '2026-09-11': 4 },
};

const PAST_DAYS: CalendarDays = { ...SPECIMEN_DAYS, max: SPECIMEN_DAYS.today };

const SWATCH = 'flex size-5 flex-none items-center justify-center rounded-sm text-[10px]';

const LEGEND = [
  { label: COPY.legend.selected, swatch: 'bg-accent', day: null },
  { label: COPY.legend.today, swatch: 'inset-ring-[1.5px] inset-ring-accent', day: null },
  { label: COPY.legend.blocked, swatch: 'bg-surface-3 text-ink-3/60', day: '28' },
] as const;

function useDaySelection(initial: string) {
  const [value, setValue] = useState<string | null>(initial);
  return { value, onSelect: setValue };
}

function DateFieldSpecimen() {
  const selection = useDaySelection('2026-09-03');
  return (
    <div className={cn(PANEL, 'gap-2.5')}>
      <Specimen eyebrow={COPY.fieldEyebrow}>
        <DateField selection={selection} days={SPECIMEN_DAYS} />
        <Note>{COPY.fieldHint}</Note>
      </Specimen>
    </div>
  );
}

function CalendarRules() {
  return (
    <div className={cn(PANEL, 'gap-2.5')}>
      <Specimen eyebrow={COPY.rulesEyebrow}>
        <p className="caption text-ink-2">{COPY.note}</p>
        <ul className="flex flex-wrap gap-2 pt-0.5">
          {LEGEND.map((entry) => (
            <li key={entry.label} className="caption flex items-center gap-1.5 text-ink-2">
              <span aria-hidden className={cn(SWATCH, entry.swatch)}>
                {entry.day}
              </span>
              {entry.label}
            </li>
          ))}
        </ul>
      </Specimen>
    </div>
  );
}

export function CalendarSection() {
  const picked = useDaySelection('2026-09-03');
  const past = useDaySelection('2026-09-01');
  return (
    <GallerySection header={COPY}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(296px,100%),1fr))] items-start gap-4">
        <div className={cn(PANEL, 'gap-3 p-4')}>
          <Calendar selection={picked} days={SPECIMEN_DAYS} />
        </div>
        <div className={cn(PANEL, 'gap-3 p-4')}>
          <Specimen eyebrow={COPY.pastEyebrow}>
            <Calendar selection={past} days={PAST_DAYS} />
          </Specimen>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <DateFieldSpecimen />
          <CalendarRules />
        </div>
      </div>
    </GallerySection>
  );
}
