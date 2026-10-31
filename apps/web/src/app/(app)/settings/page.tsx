import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { SettingsPage } from '@/widgets/settings-page';

export const metadata: Metadata = { title: uk.settings.title };

export default function SettingsRoute() {
  return <SettingsPage />;
}
