import type { AiJobStatus } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { DONE_DOT, FAILED_MARK, WAITING_DOT } from '@/shared/ui/async-state';

const COPY = uk.resumes.aiProfile;

type ProfileLook = { marker: ReactNode; tone?: string };

const LOOKS: Record<AiJobStatus, ProfileLook> = {
  queued: { marker: WAITING_DOT },
  processing: { marker: WAITING_DOT },
  done: { marker: DONE_DOT },
  failed: { marker: FAILED_MARK, tone: 'text-ink-2' },
};

export type AiProfileStatusProps = Readonly<{ status: AiJobStatus }>;

export function AiProfileStatus({ status }: AiProfileStatusProps) {
  const look = LOOKS[status];
  return (
    <span className={cn('inline-flex flex-none items-center gap-1.5', look.tone)}>
      {look.marker}
      <span>{COPY[status]}</span>
    </span>
  );
}
