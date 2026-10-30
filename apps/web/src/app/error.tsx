'use client';

import { useEffect, useState } from 'react';

import { uk } from '@/shared/i18n';
import { type IncidentError, logIncident, newIncident } from '@/shared/lib/incident';
import { CrashPanel } from '@/shared/ui/crash-panel';

export type ErrorPageProps = Readonly<{
  error: IncidentError;
  unstable_retry: () => void;
}>;

export default function ErrorPage({ error, unstable_retry: retry }: ErrorPageProps) {
  const [incident] = useState(() => newIncident({ error, now: new Date() }));
  useEffect(() => {
    logIncident({ error, incident });
  }, [error, incident]);
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col px-5 py-13 sm:px-7">
      <h1 className="sr-only">{uk.states.crash.pageTitle}</h1>
      <CrashPanel incident={incident} view={{ scope: 'page' }} onRetry={retry} />
    </main>
  );
}
