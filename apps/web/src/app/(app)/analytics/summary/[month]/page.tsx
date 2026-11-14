import { yearMonthSchema } from '@jobflow/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { uk } from '@/shared/i18n';
import { SummaryPage } from '@/widgets/monthly-summary';

export const metadata: Metadata = { title: uk.summary.page.title };

export default async function SummaryRoute({ params }: PageProps<'/analytics/summary/[month]'>) {
  const month = yearMonthSchema.safeParse((await params).month);
  if (!month.success) notFound();
  return <SummaryPage month={month.data} />;
}
