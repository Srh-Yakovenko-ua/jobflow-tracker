import type { Metadata } from 'next';

import { UnsubscribeCard } from '@/features/unsubscribe-email';
import { uk } from '@/shared/i18n';

export const metadata: Metadata = { title: uk.unsubscribe.pageTitle };

export default async function UnsubscribePage({ searchParams }: PageProps<'/unsubscribe'>) {
  const { token } = await searchParams;
  return <UnsubscribeCard token={typeof token === 'string' ? token : undefined} />;
}
