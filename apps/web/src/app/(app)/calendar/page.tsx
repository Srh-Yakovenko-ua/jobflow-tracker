import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { CalendarPage } from '@/widgets/calendar-page';

export const metadata: Metadata = { title: uk.calendarPage.title };

export default function CalendarRoute() {
  return <CalendarPage />;
}
