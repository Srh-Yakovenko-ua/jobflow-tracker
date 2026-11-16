import type { Metadata } from 'next';

import { searchPeriodOf } from '@/entities/search';
import { uk } from '@/shared/i18n';
import { AnalyticsDashboard } from '@/widgets/analytics-dashboard';
import { MonthlySummaryBlock } from '@/widgets/monthly-summary';

export const metadata: Metadata = { title: uk.analytics.title };

export default async function AnalyticsRoute({ searchParams }: PageProps<'/analytics'>) {
  const period = searchPeriodOf((await searchParams).period);
  return (
    <AnalyticsDashboard
      key={period ?? 'active'}
      period={period}
      summary={<MonthlySummaryBlock />}
    />
  );
}
