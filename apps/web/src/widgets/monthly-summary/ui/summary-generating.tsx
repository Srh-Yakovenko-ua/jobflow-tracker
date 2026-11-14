'use client';

import { uk } from '@/shared/i18n';
import { type AiJob, AsyncState } from '@/shared/ui/async-state';
import { TextSkeleton } from '@/shared/ui/skeleton';

export const SUMMARY_ETA_SECONDS = 20;

export type SummaryGeneratingProps = Readonly<{ job: AiJob }>;

export function SummaryGenerating({ job }: SummaryGeneratingProps) {
  const shown = job.status === 'processing' ? { ...job, etaSeconds: SUMMARY_ETA_SECONDS } : job;
  return (
    <AsyncState job={shown} view={{ label: uk.summary.generating }}>
      <TextSkeleton />
    </AsyncState>
  );
}
