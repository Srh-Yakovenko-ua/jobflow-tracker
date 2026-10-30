'use client';

import { uk } from '@/shared/i18n';
import { type ErrorPageProps, PageCrash } from '@/shared/ui/page-crash';

export default function ErrorPage({ error, unstable_retry: retry }: ErrorPageProps) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col px-5 py-13 sm:px-7">
      <h1 className="sr-only">{uk.states.crash.pageTitle}</h1>
      <PageCrash error={error} onRetry={retry} />
    </main>
  );
}
