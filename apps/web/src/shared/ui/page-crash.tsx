'use client';

import { useEffect, useState } from 'react';

import { type IncidentError, logIncident, newIncident } from '@/shared/lib/incident';

import { CrashPanel } from './crash-panel';

export type ErrorPageProps = Readonly<{
  error: IncidentError;
  unstable_retry: () => void;
}>;

export type PageCrashProps = Readonly<{ error: IncidentError; onRetry: () => void }>;

export function PageCrash({ error, onRetry }: PageCrashProps) {
  const [incident] = useState(() => newIncident({ error, now: new Date() }));
  useEffect(() => {
    logIncident({ error, incident });
  }, [error, incident]);
  return <CrashPanel incident={incident} view={{ scope: 'page' }} onRetry={onRetry} />;
}
