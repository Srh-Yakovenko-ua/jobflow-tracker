import { type CalendarController, useCalendarController } from '@fullcalendar/react';
import type { CalendarResponse } from '@jobflow/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { applicationHrefOf } from '@/entities/application';
import { calendarQueryOptions } from '@/entities/scheduled-event';
import { useSettledTimeZone } from '@/entities/user';
import { useRescheduleEventMutation } from '@/features/schedule-event';
import { useSilentCount } from '@/features/snooze-reminder';
import { type SectionLoad, sectionLoadOf } from '@/shared/lib/section-load';
import { useMediaQuery } from '@/shared/lib/use-media-query';

import type { GridActions, ShownPeriod } from '../lib/grid-handlers';
import type { EmptyWeek } from '../ui/calendar-empty';
import type { CalendarGridProps } from '../ui/calendar-grid';
import type { CalendarToolbarProps } from '../ui/calendar-toolbar';
import { type CalendarView, NARROW_SCREEN_QUERY } from './calendar-views';

export type CalendarPageModel = Readonly<{
  grid: CalendarGridProps | null;
  toolbar: CalendarToolbarProps;
  load: SectionLoad;
  emptyWeek: EmptyWeek | null;
}>;

function useCalendarView(controller: CalendarController) {
  const narrow = useMediaQuery(NARROW_SCREEN_QUERY);
  const [picked, setPicked] = useState<CalendarView | null>(null);
  const view = picked ?? (narrow ? 'listWeek' : 'dayGridMonth');
  useEffect(() => {
    controller.changeView(view);
  }, [controller, view]);
  return { view, narrow, onView: setPicked };
}

function useCalendarItems(period: ShownPeriod | null) {
  const items = useQuery({
    ...calendarQueryOptions(period?.range ?? null),
    placeholderData: keepPreviousData,
  });
  const fresh = items.isSuccess && !items.isPlaceholderData ? items.data : null;
  return { shown: items.data?.items ?? [], fresh, load: sectionLoadOf(items) };
}

function hasInterview(response: CalendarResponse): boolean {
  return response.items.some(({ extendedProps }) => extendedProps.type === 'scheduled_event');
}

function useGridActions(onPeriod: (period: ShownPeriod) => void): GridActions {
  const router = useRouter();
  const { reschedule } = useRescheduleEventMutation();
  return {
    onPeriod,
    onOpen: (applicationId) => {
      router.push(applicationHrefOf(applicationId));
    },
    onReschedule: reschedule,
  };
}

export function useCalendarPage(): CalendarPageModel {
  const controller = useCalendarController();
  const { view, narrow, onView } = useCalendarView(controller);
  const [period, setPeriod] = useState<ShownPeriod | null>(null);
  const { shown, fresh, load } = useCalendarItems(period);
  const timeZone = useSettledTimeZone();
  const silentCount = useSilentCount();
  const actions = useGridActions(setPeriod);
  const weekly = view !== 'dayGridMonth';
  return {
    grid:
      timeZone === null
        ? null
        : { calendar: { controller, initialView: view, items: shown, timeZone, narrow }, actions },
    toolbar: {
      period: { title: period?.title ?? '', view, current: period?.current === true },
      actions: {
        onPrevious: () => {
          controller.prev();
        },
        onToday: () => {
          if (period?.current !== true) controller.today();
        },
        onNext: () => {
          controller.next();
        },
        onView,
      },
    },
    load,
    emptyWeek:
      weekly && fresh !== null && !hasInterview(fresh)
        ? { silentCount, current: period?.current === true }
        : null,
  };
}
