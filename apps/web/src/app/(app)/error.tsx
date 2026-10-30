'use client';

import { type ErrorPageProps, PageCrash } from '@/shared/ui/page-crash';

export default function ProductErrorPage({ error, unstable_retry: retry }: ErrorPageProps) {
  return <PageCrash error={error} onRetry={retry} />;
}
