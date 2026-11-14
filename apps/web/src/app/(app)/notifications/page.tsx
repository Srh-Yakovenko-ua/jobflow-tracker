import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { NotificationsPage } from '@/widgets/notification-center';

export const metadata: Metadata = { title: uk.notifications.title };

export default function NotificationsRoute() {
  return <NotificationsPage />;
}
