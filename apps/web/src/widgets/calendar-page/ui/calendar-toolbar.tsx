import { ChevronLeft, ChevronRight } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { CALENDAR_VIEW_OPTIONS, type CalendarView } from '../model/calendar-views';

const COPY = uk.calendarPage;

const NAV_LOOK = {
  variant: 'secondary',
  size: 'sm',
  className: cn('rounded-md max-md:min-w-11', TOUCH_HEIGHT),
} as const;

export type CalendarPeriod = Readonly<{ title: string; view: CalendarView }>;

export type CalendarToolbarActions = Readonly<{
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  onView: (view: CalendarView) => void;
}>;

export type CalendarToolbarProps = Readonly<{
  period: CalendarPeriod;
  actions: CalendarToolbarActions;
}>;

export function CalendarToolbar({ period, actions }: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex items-center gap-1.25">
        <Button
          {...NAV_LOOK}
          aria-label={COPY.previous}
          icon={<ChevronLeft aria-hidden size={16} strokeWidth={1.9} />}
          onClick={actions.onPrevious}
        />
        <Button {...NAV_LOOK} onClick={actions.onToday}>
          {uk.calendar.today}
        </Button>
        <Button
          {...NAV_LOOK}
          aria-label={COPY.next}
          icon={<ChevronRight aria-hidden size={16} strokeWidth={1.9} />}
          onClick={actions.onNext}
        />
      </div>
      <h2
        aria-live="polite"
        className="min-w-42 font-display text-[15px] font-medium tracking-[-0.028em] text-ink"
      >
        {period.title}
      </h2>
      <span aria-hidden className="min-w-2 flex-1" />
      <SegmentedControl
        aria-label={COPY.viewsLabel}
        options={CALENDAR_VIEW_OPTIONS}
        value={period.view}
        onValueChange={actions.onView}
      />
    </div>
  );
}
