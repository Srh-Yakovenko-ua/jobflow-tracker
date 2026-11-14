import { type CalendarController, useCalendarController } from '@fullcalendar/react';
import type { CalendarResponse } from '@jobflow/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { calendarQueryOptions } from '@/entities/scheduled-event';
import { useSettledTimeZone } from '@/entities/user';
import { useRescheduleEventMutation } from '@/features/schedule-event';
import { useSilentCount } from '@/features/snooze-reminder';
import { useMediaQuery } from '@/shared/lib/use-media-query';

import type { GridActions, ShownPeriod } from '../lib/grid-handlers';
import type { EmptyWeek } from '../ui/calendar-empty';
import type { CalendarGridProps } from '../ui/calendar-grid';
import type { CalendarToolbarProps } from '../ui/calendar-toolbar';
import { type CalendarView, NARROW_SCREEN_QUERY } from './calendar-views';

export type CalendarLoad = Readonly<{
  pending: boolean;
  failed: boolean;
  stale: boolean;
  onRetry: () => void;
}>;

export type CalendarPageModel = Readonly<{
  grid: CalendarGridProps | null;
  toolbar: CalendarToolbarProps;
  load: CalendarLoad;
  emptyWeek: EmptyWeek | null;
}>;

function useCalendarView(controller: CalendarController) {
  const narrow = useMediaQuery(NARROW_SCREEN_QUERY);
  const [picked, setPicked] = useState<CalendarView | null>(null);
  const view = picked ?? (narrow ? 'listWeek' : 'timeGridWeek');
  useEffect(() => {
    controller.changeView(view);
  }, [controller, view]);
  return { view, onView: setPicked };
}

function useCalendarItems(period: ShownPeriod | null) {
  const items = useQuery({
    ...calendarQueryOptions(period?.range ?? null),
    placeholderData: keepPreviousData,
  });
  const onRetry = () => {
    void items.refetch();
  };
  const { data, isError } = items;
  const load: CalendarLoad = {
    pending: data === undefined && !isError,
    failed: data === undefined && isError,
    stale: data !== undefined && isError,
    onRetry,
  };
  const fresh = items.isSuccess && !items.isPlaceholderData ? items.data : null;
  return { shown: data?.items ?? [], fresh, load };
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
      router.push(`/applications/${applicationId}`);
    },
    onReschedule: reschedule,
  };
}

export function useCalendarPage(): CalendarPageModel {
  const controller = useCalendarController();
  const { view, onView } = useCalendarView(controller);
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
        : { calendar: { controller, initialView: view, items: shown, timeZone }, actions },
    toolbar: {
      period: { title: period?.title ?? '', view, current: period?.current === true },
      actions: {
        onPrevious: () => {
          controller.prev();
        },
        onToday: () => {
          controller.today();
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
