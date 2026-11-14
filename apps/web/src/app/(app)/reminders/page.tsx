import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { RemindersPage } from '@/widgets/reminders-page';

export const metadata: Metadata = { title: uk.reminders.title };

export default function RemindersRoute() {
  return <RemindersPage />;
}
