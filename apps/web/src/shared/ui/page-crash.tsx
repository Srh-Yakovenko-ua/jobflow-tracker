'use client';

import { useEffect, useState } from 'react';

import { config } from '@/shared/config';
import { type IncidentError, newIncident } from '@/shared/lib/incident';
import { reportIncident } from '@/shared/lib/report-incident';

import { CrashPanel } from './crash-panel';

export type ErrorPageProps = Readonly<{
  error: IncidentError;
  unstable_retry: () => void;
}>;

export type PageCrashProps = Readonly<{ error: IncidentError; onRetry: () => void }>;

export function PageCrash({ error, onRetry }: PageCrashProps) {
  const [incident] = useState(() => newIncident({ now: new Date() }));
  useEffect(() => {
    reportIncident({ error, incident });
  }, [error, incident]);
  return (
    <CrashPanel
      incident={incident}
      view={{ scope: 'page', reported: config.errorTracking !== undefined }}
      onRetry={onRetry}
    />
  );
}
