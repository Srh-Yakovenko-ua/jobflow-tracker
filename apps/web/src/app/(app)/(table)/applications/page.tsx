import type { Metadata } from 'next';

import { applicationFiltersOf } from '@/features/filter-applications';
import { uk } from '@/shared/i18n';
import { ApplicationsTable } from '@/widgets/applications-table';

export const metadata: Metadata = { title: uk.applicationsTable.title };

export default async function ApplicationsPage({ searchParams }: PageProps<'/applications'>) {
  const filters = applicationFiltersOf(await searchParams);
  return <ApplicationsTable initial={{ filters }} />;
}
