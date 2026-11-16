import type { Metadata } from 'next';

import { searchPeriodOf } from '@/entities/search';
import { uk } from '@/shared/i18n';
import { AnalyticsReport } from '@/widgets/analytics-dashboard';

export const metadata: Metadata = { title: uk.analytics.report.title };

export default async function AnalyticsReportRoute({
  searchParams,
}: PageProps<'/analytics/report'>) {
  return <AnalyticsReport period={searchPeriodOf((await searchParams).period)} />;
}
