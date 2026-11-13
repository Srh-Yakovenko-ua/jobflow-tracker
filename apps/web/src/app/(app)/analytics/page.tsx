import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { AnalyticsDashboard } from '@/widgets/analytics-dashboard';

export const metadata: Metadata = { title: uk.analytics.title };

export default function AnalyticsRoute() {
  return <AnalyticsDashboard />;
}
