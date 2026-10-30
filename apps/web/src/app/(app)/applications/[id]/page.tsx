import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { ApplicationPage } from '@/widgets/application-page';

export const metadata: Metadata = { title: uk.applicationPage.title };

export default async function ApplicationRoute({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationPage id={id} view={{ mode: 'page' }} />;
}
