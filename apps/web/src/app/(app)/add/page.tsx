import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { AddApplicationPage } from '@/widgets/add-application-page';

export const metadata: Metadata = { title: uk.add.title };

export default async function AddPage({ searchParams }: PageProps<'/add'>) {
  const { url, text, path, review } = await searchParams;
  return <AddApplicationPage query={{ url, text, path, review }} />;
}
