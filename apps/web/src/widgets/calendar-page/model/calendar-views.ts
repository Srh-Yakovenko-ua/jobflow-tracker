import { uk } from '@/shared/i18n';
import type { ChoiceOption } from '@/shared/ui/radio-group';

const VIEWS = uk.calendarPage.views;

export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'listWeek';

export const NARROW_SCREEN_QUERY = '(width < 48rem)';

export const CALENDAR_VIEW_OPTIONS: readonly ChoiceOption<CalendarView>[] = [
  { value: 'dayGridMonth', label: VIEWS.month },
  { value: 'timeGridWeek', label: VIEWS.week },
  { value: 'listWeek', label: VIEWS.list },
];
