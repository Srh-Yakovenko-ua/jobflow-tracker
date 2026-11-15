import type { Metadata } from 'next';
import { z } from 'zod';

import { uk } from '@/shared/i18n';
import { AnalyticsReport } from '@/widgets/analytics-dashboard';

export const metadata: Metadata = { title: uk.analytics.report.title };

const periodSchema = z.uuid();

export default async function AnalyticsReportRoute({
  searchParams,
}: PageProps<'/analytics/report'>) {
  const parsed = periodSchema.safeParse((await searchParams).period);
  return <AnalyticsReport period={parsed.success ? parsed.data : undefined} />;
}
